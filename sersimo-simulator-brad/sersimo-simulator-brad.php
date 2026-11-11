<?php
/**
 * Plugin Name:       Sersimo – Simulator brad
 * Description:       Buton „Vezi bradul în camera ta” pe pagina de produs: simulator la scară reală, comparare înălțimi, poză proprie. Măsoară utilizarea și marchează comenzile venite din simulator.
 * Version:           1.2.0
 * Author:            Pruntech
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Requires Plugins:  woocommerce
 * WC requires at least: 7.0
 * Text Domain:       sersimo-simulator-brad
 */

defined( 'ABSPATH' ) || exit;

define( 'SSB_VERSION', '1.2.0' );
define( 'SSB_FILE', __FILE__ );
define( 'SSB_DIR', plugin_dir_path( __FILE__ ) );
define( 'SSB_URL', plugin_dir_url( __FILE__ ) );

// Compatibilitate declarată cu HPOS (comenzi în tabele proprii) și checkout-ul pe blocuri.
add_action( 'before_woocommerce_init', function () {
	if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', SSB_FILE, true );
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', SSB_FILE, true );
	}
} );

add_action( 'plugins_loaded', function () {
	if ( ! class_exists( 'WooCommerce' ) ) {
		return;
	}
	require_once SSB_DIR . 'includes/class-ssb-settings.php';
	require_once SSB_DIR . 'includes/class-ssb-product.php';
	require_once SSB_DIR . 'includes/class-ssb-admin.php';
	require_once SSB_DIR . 'includes/class-ssb-frontend.php';
	require_once SSB_DIR . 'includes/class-ssb-tracking.php';
	require_once SSB_DIR . 'includes/class-ssb-stats.php';

	SSB_Admin::init();
	SSB_Frontend::init();
	SSB_Tracking::init();
	SSB_Stats::init();
} );

add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=ssb-simulator' ) ) . '">Setări și statistici</a>' );
	return $links;
} );
