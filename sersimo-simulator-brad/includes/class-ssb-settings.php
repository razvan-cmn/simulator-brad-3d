<?php
defined( 'ABSPATH' ) || exit;

/** Setări globale (WooCommerce → Simulator brad). */
class SSB_Settings {
	const OPTION = 'ssb_settings';

	public static function defaults() {
		return array(
			'auto_button'  => 'yes',  // afișează automat butonul sub „Adaugă în coș”
			'button_text'  => '🎄 Vezi bradul în camera ta',
			'utm_enabled'  => 'yes',  // adaugă UTM pe linkul de adăugare în coș din simulator
			'utm_source'   => 'simulator-brad',
			'utm_medium'   => 'configurator',
			'utm_campaign' => 'simulator-brad',
			'brand'        => 'sersimo.ro',
		);
	}

	public static function get( $key = null ) {
		$s = wp_parse_args( (array) get_option( self::OPTION, array() ), self::defaults() );
		return null === $key ? $s : ( isset( $s[ $key ] ) ? $s[ $key ] : null );
	}

	public static function save( array $in ) {
		$d   = self::defaults();
		$out = array();
		foreach ( $d as $k => $def ) {
			if ( in_array( $k, array( 'auto_button', 'utm_enabled' ), true ) ) {
				$out[ $k ] = empty( $in[ $k ] ) ? 'no' : 'yes';
			} elseif ( isset( $in[ $k ] ) ) {
				$v         = sanitize_text_field( wp_unslash( $in[ $k ] ) );
				$out[ $k ] = '' === $v ? $def : $v;
			} else {
				$out[ $k ] = $def;
			}
		}
		update_option( self::OPTION, $out );
	}

	/** Parametrii UTM (gol dacă sunt dezactivați). */
	public static function utm_args() {
		$s = self::get();
		if ( 'yes' !== $s['utm_enabled'] ) {
			return array();
		}
		// add_query_arg() nu codează valorile: le codăm noi (spații, & etc. ar strica linkul).
		return array_map( 'rawurlencode', array(
			'utm_source'   => $s['utm_source'],
			'utm_medium'   => $s['utm_medium'],
			'utm_campaign' => $s['utm_campaign'],
		) );
	}
}
