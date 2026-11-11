<?php
defined( 'ABSPATH' ) || exit;

/**
 * Datele de simulator ale unui produs (meta) + gruparea pe „familie”.
 * Fiecare înălțime e un produs WooCommerce separat; produsele cu aceeași familie apar ca mărimi în simulator.
 */
class SSB_Product {
	const META_ENABLED  = '_ssb_enabled';
	const META_FAMILY   = '_ssb_family';
	const META_HEIGHT   = '_ssb_height';
	const META_DIAMETER = '_ssb_diameter';
	const META_CUTOUT   = '_ssb_cutout_id';
	const META_BASEX    = '_ssb_base_x';

	public static function is_enabled( $product_id ) {
		return 'yes' === get_post_meta( $product_id, self::META_ENABLED, true )
			&& '' !== trim( (string) get_post_meta( $product_id, self::META_FAMILY, true ) );
	}

	/** Înălțimea: din câmp, altfel din titlu („... 220cm”). */
	public static function height( $product_id ) {
		$h = absint( get_post_meta( $product_id, self::META_HEIGHT, true ) );
		if ( ! $h && preg_match( '/(\d{2,3})\s*cm/i', get_the_title( $product_id ), $m ) ) {
			$h = absint( $m[1] );
		}
		return $h;
	}

	/** Diametrul: din câmp, altfel estimat la 60% din înălțime. */
	public static function diameter( $product_id, $height ) {
		$d = absint( get_post_meta( $product_id, self::META_DIAMETER, true ) );
		return $d ? $d : (int) round( $height * 0.6 );
	}

	public static function cutout_url( $product_id ) {
		$id = absint( get_post_meta( $product_id, self::META_CUTOUT, true ) );
		if ( ! $id ) {
			return '';
		}
		$src = wp_get_attachment_image_src( $id, 'full' );
		return $src ? $src[0] : '';
	}

	public static function base_x( $product_id ) {
		$v = get_post_meta( $product_id, self::META_BASEX, true );
		return '' === $v ? 0.5 : max( 0.0, min( 1.0, (float) $v ) );
	}

	/** ID-urile produselor publicate din aceeași familie. */
	public static function family_ids( $family ) {
		return get_posts( array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'fields'         => 'ids',
			'posts_per_page' => 30,
			'no_found_rows'  => true,
			'meta_query'     => array(
				array( 'key' => self::META_ENABLED, 'value' => 'yes' ),
				array( 'key' => self::META_FAMILY, 'value' => $family ),
			),
		) );
	}

	/** Configurația JSON pentru simulator, pornind de la produsul curent. Null dacă nu se poate afișa. */
	public static function config_for( $product_id ) {
		if ( ! self::is_enabled( $product_id ) ) {
			return null;
		}
		$family = trim( (string) get_post_meta( $product_id, self::META_FAMILY, true ) );
		$sizes  = array();

		foreach ( self::family_ids( $family ) as $id ) {
			$p = wc_get_product( $id );
			if ( ! $p || ! $p->is_visible() || ! $p->is_type( 'simple' ) ) {
				continue; // doar produse simple; produsele variabile nu sunt suportate în v1
			}
			$h = self::height( $id );
			if ( ! $h ) {
				continue;
			}
			$price   = (float) wc_get_price_to_display( $p );
			$sizes[] = array(
				'id'        => $id,
				'name'      => $p->get_name(),
				'h'         => $h,
				'd'         => self::diameter( $id, $h ),
				'price'     => $price,
				'priceText' => html_entity_decode( wp_strip_all_tags( wc_price( $price ) ), ENT_QUOTES, 'UTF-8' ),
				'url'       => get_permalink( $id ),
				'cartUrl'   => add_query_arg(
					array_merge( array( 'add-to-cart' => $id, 'quantity' => 1, 'ssb' => 1 ), SSB_Settings::utm_args() ),
					get_permalink( $id )
				),
				'inStock'   => $p->is_purchasable() && $p->is_in_stock(),
				'cutout'    => self::cutout_url( $id ),
				'baseX'     => self::base_x( $id ),
			);
		}

		// Mărimile fără decupaj propriu îl folosesc pe al celei mai apropiate mărimi care are unul.
		$with = array_values( array_filter( $sizes, function ( $s ) { return '' !== $s['cutout']; } ) );
		if ( ! $with ) {
			return null;
		}
		foreach ( $sizes as &$s ) {
			if ( '' === $s['cutout'] ) {
				usort( $with, function ( $a, $b ) use ( $s ) { return abs( $a['h'] - $s['h'] ) - abs( $b['h'] - $s['h'] ); } );
				$s['cutout'] = $with[0]['cutout'];
				$s['baseX']  = $with[0]['baseX'];
			}
		}
		unset( $s );

		usort( $sizes, function ( $a, $b ) { return $a['h'] - $b['h']; } );
		$current = 0;
		foreach ( $sizes as $i => $s ) {
			if ( (int) $s['id'] === (int) $product_id ) {
				$current = $i;
			}
		}
		if ( ! $sizes ) {
			return null;
		}

		return array(
			'family'   => $family,
			'name'     => $sizes[ $current ]['name'],
			'current'  => $current,
			'sizes'    => $sizes,
			'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
			'brand'    => SSB_Settings::get( 'brand' ),
			'currency' => get_woocommerce_currency(),
		);
	}
}
