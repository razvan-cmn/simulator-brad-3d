<?php
defined( 'ABSPATH' ) || exit;

/** Butonul de pe pagina de produs + încărcarea simulatorului. */
class SSB_Frontend {
	private static $printed = false;

	public static function init() {
		add_action( 'woocommerce_after_add_to_cart_form', array( __CLASS__, 'auto_button' ), 15 );
		add_shortcode( 'sersimo_simulator_brad', array( __CLASS__, 'shortcode' ) );
	}

	public static function auto_button() {
		if ( 'yes' !== SSB_Settings::get( 'auto_button' ) ) {
			return;
		}
		echo self::render( get_the_ID() ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escapat în render().
	}

	/** [sersimo_simulator_brad] sau [sersimo_simulator_brad id="123" text="..."] — pentru teme/page builder (Elementor etc.). */
	public static function shortcode( $atts ) {
		$atts = shortcode_atts( array( 'id' => 0, 'text' => '' ), $atts, 'sersimo_simulator_brad' );
		$id   = absint( $atts['id'] ) ? absint( $atts['id'] ) : get_the_ID();
		return self::render( $id, $atts['text'] );
	}

	public static function render( $product_id, $text = '' ) {
		if ( self::$printed || ! $product_id ) {
			return '';
		}
		$config = SSB_Product::config_for( $product_id );
		if ( ! $config ) {
			return '';
		}
		self::$printed = true;

		wp_enqueue_style( 'ssb-simulator', SSB_URL . 'assets/simulator.css', self::font_deps(), SSB_VERSION );
		wp_enqueue_script( 'ssb-simulator', SSB_URL . 'assets/simulator.js', array(), SSB_VERSION, true );
		wp_add_inline_script( 'ssb-simulator', 'window.SSB_CONFIG=' . wp_json_encode( $config ) . ';', 'before' );

		$label = '' !== $text ? $text : SSB_Settings::get( 'button_text' );
		return '<button type="button" class="ssb-open-btn">' . esc_html( $label ) . '</button>';
	}

	/**
	 * Fontul Oswald: îl folosim pe cel găzduit local de Elementor (fără conexiune la Google → fără problemă GDPR).
	 * Dacă tema îl încarcă deja, fișierul e același și browserul nu îl descarcă de două ori.
	 */
	private static function font_deps() {
		$up = wp_upload_dir( null, false );
		if ( empty( $up['basedir'] ) || ! file_exists( $up['basedir'] . '/elementor/google-fonts/css/oswald.css' ) ) {
			return array();
		}
		wp_register_style( 'ssb-oswald', $up['baseurl'] . '/elementor/google-fonts/css/oswald.css', array(), null );
		return array( 'ssb-oswald' );
	}
}
