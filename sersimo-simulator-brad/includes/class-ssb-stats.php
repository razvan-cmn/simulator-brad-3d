<?php
defined( 'ABSPATH' ) || exit;

/** WooCommerce → Simulator brad: setări + statistici. */
class SSB_Stats {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ), 60 );
	}

	public static function menu() {
		add_submenu_page( 'woocommerce', 'Simulator brad', 'Simulator brad', 'manage_woocommerce', 'ssb-simulator', array( __CLASS__, 'page' ) );
	}

	private static function sum_days( $days ) {
		$s   = get_option( SSB_Tracking::STATS_OPTION, array() );
		$out = array_fill_keys( SSB_Tracking::EVENTS, 0 );
		$min = wp_date( 'Y-m-d', time() - ( $days - 1 ) * DAY_IN_SECONDS );
		if ( ! empty( $s['d'] ) ) {
			foreach ( $s['d'] as $day => $ev ) {
				if ( $day >= $min ) {
					foreach ( $ev as $k => $n ) {
						$out[ $k ] = ( isset( $out[ $k ] ) ? $out[ $k ] : 0 ) + $n;
					}
				}
			}
		}
		return $out;
	}

	private static function orders( $source, $days ) {
		$orders = wc_get_orders( array(
			'limit'        => -1,
			'status'       => array( 'wc-processing', 'wc-completed', 'wc-on-hold' ),
			'date_created' => '>' . ( time() - $days * DAY_IN_SECONDS ),
			'meta_query'   => array( array( 'key' => SSB_Tracking::ORDER_META, 'value' => $source ) ),
		) );
		$total = 0.0;
		foreach ( $orders as $o ) {
			$total += (float) $o->get_total();
		}
		return array( count( $orders ), $total );
	}

	private static function pct( $a, $b ) {
		return $b ? number_format_i18n( 100 * $a / $b, 1 ) . '%' : '–';
	}

	public static function page() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		if ( isset( $_POST['ssb_save'] ) && check_admin_referer( 'ssb_settings' ) ) {
			SSB_Settings::save( $_POST );
			echo '<div class="notice notice-success"><p>Setări salvate.</p></div>';
		}
		if ( isset( $_POST['ssb_reset_stats'] ) && check_admin_referer( 'ssb_settings' ) ) {
			delete_option( SSB_Tracking::STATS_OPTION );
			echo '<div class="notice notice-success"><p>Statisticile de utilizare au fost resetate.</p></div>';
		}

		$days = isset( $_GET['days'] ) ? max( 1, min( 365, absint( $_GET['days'] ) ) ) : 30; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$e    = self::sum_days( $days );
		list( $added_n, $added_v ) = self::orders( 'added', $days );
		list( $used_n, $used_v )   = self::orders( 'used', $days );
		$set  = SSB_Settings::get();

		echo '<div class="wrap"><h1>Simulator brad</h1>';

		// ---- perioadă
		echo '<p>Perioadă: ';
		foreach ( array( 7, 30, 90, 365 ) as $d ) {
			$url = add_query_arg( array( 'page' => 'ssb-simulator', 'days' => $d ), admin_url( 'admin.php' ) );
			echo $d === $days ? '<strong>' . esc_html( $d ) . ' zile</strong> ' : '<a href="' . esc_url( $url ) . '">' . esc_html( $d ) . ' zile</a> ';
		}
		echo '</p>';

		// ---- sumar
		$cards = array(
			array( 'Afișări pagină cu buton', $e['view'], '' ),
			array( 'Deschideri simulator', $e['open'], 'rată: ' . self::pct( $e['open'], $e['view'] ) . ' din afișări' ),
			array( 'Vizitatori unici (zi/produs)', $e['open_unique'], '' ),
			array( 'Click „Adaugă în coș” din simulator', $e['cart'], self::pct( $e['cart'], $e['open'] ) . ' din deschideri' ),
			array( 'Comenzi cu produs adăugat din simulator', $added_n, wp_strip_all_tags( wc_price( $added_v ) ) ),
			array( 'Comenzi după folosirea simulatorului', $used_n, wp_strip_all_tags( wc_price( $used_v ) ) . ' (au adăugat din pagină)' ),
		);
		echo '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin:12px 0 20px">';
		foreach ( $cards as $c ) {
			echo '<div style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:14px 16px">';
			echo '<div style="color:#646970;font-size:12px">' . esc_html( $c[0] ) . '</div>';
			echo '<div style="font-size:26px;font-weight:600;margin:4px 0">' . esc_html( number_format_i18n( $c[1] ) ) . '</div>';
			echo '<div style="color:#646970;font-size:12px">' . esc_html( $c[2] ) . '</div></div>';
		}
		echo '</div>';
		echo '<p class="description">Comenzile numărate: în procesare, finalizate, în așteptare. Statisticile nu includ vizitele administratorilor / editorilor logați. Lista de comenzi are coloana „Simulator”.</p>';

		// ---- detaliu acțiuni
		$labels = array(
			'size' => 'Schimbări de înălțime', 'compare' => 'Comparare înălțimi', 'move' => 'A mutat bradul',
			'room_3d' => '3D / AR: a deschis vederea 3D', 'ar_android' => 'AR pornit pe Android', 'ar_place' => 'AR Android: a pus bradul', 'ar_ios' => 'AR pornit pe iPhone', 'ar_qr' => 'Calculator: a văzut codul QR pentru telefon',
			'room_living' => 'Cameră: living', 'room_empty' => 'Cameră: bloc / casă', 'room_photo' => 'Cameră: poza proprie', 'room_preset' => 'Bloc / Casă: a ales un preset', 'room_custom' => 'Bloc / Casă: a folosit Custom',
			'photo_upload' => 'Poze încărcate', 'photo_calibrate' => 'Poze calibrate cu obiect', 'photo_mask' => 'Poze cu obiecte în față', 'shot' => 'Capturi salvate', 'share' => 'Capturi trimise (telefon)', 'cart_oos' => 'Click pe produs fără stoc',
		);
		echo '<h2>Ce fac utilizatorii în simulator</h2><table class="widefat striped" style="max-width:560px"><tbody>';
		foreach ( $labels as $k => $l ) {
			echo '<tr><td>' . esc_html( $l ) . '</td><td style="text-align:right">' . esc_html( number_format_i18n( $e[ $k ] ) ) . '</td></tr>';
		}
		echo '</tbody></table>';

		// ---- pe produs (total de la instalare)
		$s = get_option( SSB_Tracking::STATS_OPTION, array() );
		if ( ! empty( $s['p'] ) ) {
			$rows = $s['p'];
			uasort( $rows, function ( $a, $b ) { return ( isset( $b['open'] ) ? $b['open'] : 0 ) - ( isset( $a['open'] ) ? $a['open'] : 0 ); } );
			echo '<h2>Pe produs (total)</h2><table class="widefat striped" style="max-width:860px"><thead><tr><th>Produs</th><th>Afișări</th><th>Deschideri</th><th>Rată</th><th>Click coș</th></tr></thead><tbody>';
			foreach ( array_slice( $rows, 0, 60, true ) as $pid => $r ) {
				$v = isset( $r['view'] ) ? $r['view'] : 0;
				$o = isset( $r['open'] ) ? $r['open'] : 0;
				$c = isset( $r['cart'] ) ? $r['cart'] : 0;
				echo '<tr><td><a href="' . esc_url( get_edit_post_link( $pid ) ) . '">' . esc_html( get_the_title( $pid ) ) . '</a></td><td>' . esc_html( $v ) . '</td><td>' . esc_html( $o ) . '</td><td>' . esc_html( self::pct( $o, $v ) ) . '</td><td>' . esc_html( $c ) . '</td></tr>';
			}
			echo '</tbody></table>';
		}

		// ---- setări
		echo '<h2 style="margin-top:28px">Setări</h2><form method="post">';
		wp_nonce_field( 'ssb_settings' );
		echo '<table class="form-table"><tbody>';
		echo '<tr><th>Buton automat</th><td><label><input type="checkbox" name="auto_button" value="1" ' . checked( 'yes', $set['auto_button'], false ) . '> Afișează butonul sub „Adaugă în coș” pe produsele activate</label><p class="description">Dacă tema/page builder-ul nu îl afișează, debifează și folosește shortcode-ul <code>[sersimo_simulator_brad]</code>.</p></td></tr>';
		echo '<tr><th><label for="ssb_bt">Text buton</label></th><td><input id="ssb_bt" class="regular-text" name="button_text" value="' . esc_attr( $set['button_text'] ) . '"></td></tr>';
		echo '<tr><th><label for="ssb_br">Text pe captură</label></th><td><input id="ssb_br" class="regular-text" name="brand" value="' . esc_attr( $set['brand'] ) . '"></td></tr>';
		echo '<tr><th>UTM</th><td><label><input type="checkbox" name="utm_enabled" value="1" ' . checked( 'yes', $set['utm_enabled'], false ) . '> Adaugă UTM la adăugarea în coș din simulator</label>';
		echo '<p class="description">Atenție: un UTM pe un link intern înlocuiește sursa originală a vizitei (ex. reclama Facebook) în GA4 și în „Origine” din WooCommerce. Marcarea comenzilor din coloana „Simulator” funcționează și fără UTM.</p>';
		foreach ( array( 'utm_source', 'utm_medium', 'utm_campaign' ) as $k ) {
			echo '<p><label><code>' . esc_html( $k ) . '</code> <input name="' . esc_attr( $k ) . '" value="' . esc_attr( $set[ $k ] ) . '"></label></p>';
		}
		echo '</td></tr></tbody></table>';
		submit_button( 'Salvează setările', 'primary', 'ssb_save' );
		echo '<p><button class="button button-link-delete" name="ssb_reset_stats" value="1" onclick="return confirm(\'Resetezi statisticile de utilizare? Comenzile rămân marcate.\')">Resetează statisticile de utilizare</button></p>';
		echo '</form></div>';
	}
}
