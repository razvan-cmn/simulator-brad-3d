<?php
defined( 'ABSPATH' ) || exit;

/**
 * Măsurare:
 *  1. Evenimente anonime (afișare buton, deschidere, schimbare mărime, poză, adăugare în coș) – contoare zilnice în wp_options.
 *  2. Atribuire comandă:
 *     - „added” = cel puțin un produs a fost adăugat în coș DIN simulator (link cu ?ssb=1);
 *     - „used”  = clientul a deschis simulatorul în ultimele 30 de zile (cookie ssb_used), dar a adăugat pe altă cale.
 *     Se salvează în meta comenzii `_ssb_source`, plus o notă pe comandă și o coloană în lista de comenzi.
 *  3. UTM (opțional, din setări) pe linkul de adăugare în coș – vizibil în GA4 și în „Origine” (Order Attribution) din WooCommerce.
 */
class SSB_Tracking {
	const STATS_OPTION = 'ssb_stats';
	const ORDER_META   = '_ssb_source';
	const ITEM_META    = '_ssb_sim';
	const EVENTS       = array( 'view', 'open', 'open_unique', 'size', 'room_living', 'room_empty', 'room_photo', 'room_preset', 'room_custom', 'photo_upload', 'photo_calibrate', 'photo_mask', 'move', 'compare', 'shot', 'share', 'cart', 'cart_oos' );

	public static function init() {
		add_action( 'wp_ajax_ssb_event', array( __CLASS__, 'ajax_event' ) );
		add_action( 'wp_ajax_nopriv_ssb_event', array( __CLASS__, 'ajax_event' ) );

		add_filter( 'woocommerce_add_cart_item_data', array( __CLASS__, 'cart_item_data' ), 10, 2 );
		add_filter( 'woocommerce_add_to_cart_redirect', array( __CLASS__, 'redirect_to_cart' ), 20 );
		add_action( 'woocommerce_checkout_create_order_line_item', array( __CLASS__, 'line_item_meta' ), 10, 3 );
		add_action( 'woocommerce_checkout_order_created', array( __CLASS__, 'mark_order' ) );            // checkout clasic
		add_action( 'woocommerce_store_api_checkout_order_processed', array( __CLASS__, 'mark_order' ) ); // checkout pe blocuri

		// Coloană „Simulator” în lista de comenzi (vechi + HPOS).
		add_filter( 'manage_edit-shop_order_columns', array( __CLASS__, 'order_column' ), 20 );
		add_action( 'manage_shop_order_posts_custom_column', array( __CLASS__, 'order_column_legacy' ), 10, 2 );
		add_filter( 'manage_woocommerce_page_wc-orders_columns', array( __CLASS__, 'order_column' ), 20 );
		add_action( 'manage_woocommerce_page_wc-orders_custom_column', array( __CLASS__, 'order_column_hpos' ), 10, 2 );
	}

	/* ---------------- evenimente ---------------- */

	public static function ajax_event() {
		// Fără nonce intenționat: paginile de produs sunt de obicei în cache, iar contorul e anonim și nesensibil.
		// phpcs:disable WordPress.Security.NonceVerification.Missing
		$event   = isset( $_POST['event'] ) ? sanitize_key( wp_unslash( $_POST['event'] ) ) : '';
		$product = isset( $_POST['product'] ) ? absint( $_POST['product'] ) : 0;
		// phpcs:enable
		if ( ! in_array( $event, self::EVENTS, true ) || self::should_skip() ) {
			wp_die( '', '', array( 'response' => 204 ) );
		}
		self::count( $event, $product );
		wp_die( '', '', array( 'response' => 204 ) );
	}

	private static function should_skip() {
		if ( current_user_can( 'edit_products' ) ) {
			return true; // nu numărăm echipa care testează
		}
		$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? strtolower( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) ) : '';
		return '' === $ua || (bool) preg_match( '/bot|crawl|spider|slurp|preview|headless|lighthouse/', $ua );
	}

	public static function count( $event, $product_id ) {
		$s   = get_option( self::STATS_OPTION, array() );
		$s   = is_array( $s ) ? $s : array();
		$day = wp_date( 'Y-m-d' );
		$s['d'][ $day ][ $event ] = ( isset( $s['d'][ $day ][ $event ] ) ? $s['d'][ $day ][ $event ] : 0 ) + 1;
		if ( $product_id ) {
			$s['p'][ $product_id ][ $event ] = ( isset( $s['p'][ $product_id ][ $event ] ) ? $s['p'][ $product_id ][ $event ] : 0 ) + 1;
		}
		// păstrăm ultimele 400 de zile
		if ( isset( $s['d'] ) && count( $s['d'] ) > 400 ) {
			ksort( $s['d'] );
			$s['d'] = array_slice( $s['d'], -400, null, true );
		}
		update_option( self::STATS_OPTION, $s, false );
	}

	/* ---------------- coș + comandă ---------------- */

	private static function from_simulator_request() {
		return ! empty( $_REQUEST['ssb'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	public static function cart_item_data( $data, $product_id ) {
		if ( self::from_simulator_request() ) {
			$data['ssb_sim'] = 1;
		}
		return $data;
	}

	/** După adăugarea din simulator mergem direct în coș (evită re-adăugarea la refresh) și păstrăm UTM-urile. */
	public static function redirect_to_cart( $url ) {
		if ( ! self::from_simulator_request() ) {
			return $url;
		}
		return add_query_arg( SSB_Settings::utm_args(), wc_get_cart_url() );
	}

	public static function line_item_meta( $item, $cart_item_key, $values ) {
		if ( ! empty( $values['ssb_sim'] ) ) {
			$item->add_meta_data( self::ITEM_META, 'yes', true );
		}
	}

	public static function mark_order( $order ) {
		if ( ! $order instanceof WC_Order ) {
			$order = wc_get_order( $order );
		}
		if ( ! $order || $order->get_meta( self::ORDER_META ) ) {
			return;
		}
		$added = false;
		foreach ( $order->get_items() as $item ) {
			if ( 'yes' === $item->get_meta( self::ITEM_META ) ) {
				$added = true;
				break;
			}
		}
		$used = ! empty( $_COOKIE['ssb_used'] );
		if ( ! $added && ! $used ) {
			return;
		}
		$order->update_meta_data( self::ORDER_META, $added ? 'added' : 'used' );
		$order->save();
		$order->add_order_note( $added
			? 'Simulator brad: produs adăugat în coș din simulator.'
			: 'Simulator brad: clientul a folosit simulatorul înainte de comandă (a adăugat în coș din pagină).' );
	}

	/* ---------------- coloană listă comenzi ---------------- */

	public static function order_column( $cols ) {
		$new = array();
		foreach ( $cols as $k => $v ) {
			$new[ $k ] = $v;
			if ( 'order_status' === $k ) {
				$new['ssb'] = 'Simulator';
			}
		}
		if ( ! isset( $new['ssb'] ) ) {
			$new['ssb'] = 'Simulator';
		}
		return $new;
	}

	public static function order_column_legacy( $col, $post_id ) {
		if ( 'ssb' === $col ) {
			self::column_value( wc_get_order( $post_id ) );
		}
	}

	public static function order_column_hpos( $col, $order ) {
		if ( 'ssb' === $col ) {
			self::column_value( $order );
		}
	}

	private static function column_value( $order ) {
		$v = $order ? $order->get_meta( self::ORDER_META ) : '';
		if ( 'added' === $v ) {
			echo '<mark class="order-status status-completed" title="Adăugat în coș din simulator"><span>🎄 din simulator</span></mark>';
		} elseif ( 'used' === $v ) {
			echo '<mark class="order-status status-on-hold" title="A folosit simulatorul, a adăugat din pagină"><span>a folosit</span></mark>';
		} else {
			echo '<span aria-hidden="true">–</span>';
		}
	}
}
