<?php
defined( 'ABSPATH' ) || exit;

/** Tab „Simulator brad” în Date produs (editare produs). */
class SSB_Admin {

	public static function init() {
		add_filter( 'woocommerce_product_data_tabs', array( __CLASS__, 'tab' ) );
		add_action( 'woocommerce_product_data_panels', array( __CLASS__, 'panel' ) );
		add_action( 'woocommerce_admin_process_product_object', array( __CLASS__, 'save' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
	}

	public static function tab( $tabs ) {
		$tabs['ssb'] = array(
			'label'    => 'Simulator brad',
			'target'   => 'ssb_product_data',
			'class'    => array( 'show_if_simple' ),
			'priority' => 75,
		);
		return $tabs;
	}

	public static function assets( $hook ) {
		$screen = get_current_screen();
		if ( ! $screen || 'product' !== $screen->id ) {
			return;
		}
		wp_enqueue_media();
		wp_add_inline_script( 'jquery-core', self::media_js() );
	}

	private static function media_js() {
		return <<<'JS'
jQuery(function($){
  var frame;
  $(document).on('click', '#ssb_cutout_pick', function(e){
    e.preventDefault();
    if (!frame) {
      frame = wp.media({ title: 'Decupaj brad (PNG/WebP transparent)', button: { text: 'Folosește imaginea' }, library: { type: 'image' }, multiple: false });
      frame.on('select', function(){
        var a = frame.state().get('selection').first().toJSON();
        $('#_ssb_cutout_id').val(a.id);
        $('#ssb_cutout_preview').html('<img src="'+(a.sizes && a.sizes.medium ? a.sizes.medium.url : a.url)+'" style="max-height:160px;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px">');
      });
    }
    frame.open();
  });
  $(document).on('click', '#ssb_cutout_clear', function(e){ e.preventDefault(); $('#_ssb_cutout_id').val(''); $('#ssb_cutout_preview').empty(); });
});
JS;
	}

	public static function panel() {
		global $post;
		$id     = $post->ID;
		$cutout = absint( get_post_meta( $id, SSB_Product::META_CUTOUT, true ) );
		$guessH = SSB_Product::height( $id );

		echo '<div id="ssb_product_data" class="panel woocommerce_options_panel hidden">';
		echo '<div class="options_group">';

		woocommerce_wp_checkbox( array(
			'id'          => SSB_Product::META_ENABLED,
			'label'       => 'Activează simulatorul',
			'description' => 'Afișează butonul „Vezi bradul în camera ta” pe acest produs.',
		) );
		woocommerce_wp_text_input( array(
			'id'          => SSB_Product::META_FAMILY,
			'label'       => 'Familie (model)',
			'placeholder' => 'ex: Frasin de Munte 2D',
			'desc_tip'    => true,
			'description' => 'Scrie EXACT același text la toate înălțimile aceluiași model. Ele apar ca mărimi în simulator, iar textul apare ca titlu.',
		) );
		woocommerce_wp_text_input( array(
			'id'                => SSB_Product::META_HEIGHT,
			'label'             => 'Înălțime (cm)',
			'type'              => 'number',
			'placeholder'       => $guessH ? $guessH . ' (din titlu)' : '',
			'custom_attributes' => array( 'min' => 30, 'max' => 600, 'step' => 1 ),
			'desc_tip'          => true,
			'description'       => 'Gol = se citește din titlu (ex. „220cm”).',
		) );
		woocommerce_wp_text_input( array(
			'id'                => SSB_Product::META_DIAMETER,
			'label'             => 'Diametru la bază (cm)',
			'type'              => 'number',
			'custom_attributes' => array( 'min' => 10, 'max' => 400, 'step' => 1 ),
			'desc_tip'          => true,
			'description'       => 'Cea mai lată parte a bradului. Gol = estimat la 60% din înălțime (nu recomandat).',
		) );
		echo '</div><div class="options_group">';

		echo '<p class="form-field"><label>Decupaj brad</label>';
		echo '<input type="hidden" id="_ssb_cutout_id" name="_ssb_cutout_id" value="' . esc_attr( $cutout ? $cutout : '' ) . '">';
		echo '<button type="button" class="button" id="ssb_cutout_pick">Alege imaginea</button> ';
		echo '<button type="button" class="button-link" id="ssb_cutout_clear">Șterge</button>';
		echo wc_help_tip( 'PNG sau WebP cu fundal transparent, tăiat strâns: sus = vârful, jos = picioarele suportului, stânga/dreapta = cele mai late ramuri. Poate lipsi la unele înălțimi – se folosește decupajul altei înălțimi din aceeași familie.' );
		echo '<span id="ssb_cutout_preview" style="display:block;margin-top:8px">';
		if ( $cutout ) {
			echo wp_get_attachment_image( $cutout, 'medium', false, array( 'style' => 'max-height:160px;width:auto;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px' ) );
		}
		echo '</span></p>';

		woocommerce_wp_text_input( array(
			'id'                => SSB_Product::META_BASEX,
			'label'             => 'Poziția trunchiului (0–1)',
			'type'              => 'number',
			'placeholder'       => '0.5',
			'custom_attributes' => array( 'min' => 0, 'max' => 1, 'step' => 0.005 ),
			'desc_tip'          => true,
			'description'       => 'Unde e trunchiul pe lățimea decupajului: 0 = margine stânga, 0.5 = mijloc, 1 = margine dreapta. Contează doar dacă bradul nu e simetric.',
		) );
		echo '</div></div>';
	}

	/** @param WC_Product $product */
	public static function save( $product ) {
		// phpcs:disable WordPress.Security.NonceVerification.Missing -- nonce-ul e verificat de WooCommerce la salvarea produsului.
		$product->update_meta_data( SSB_Product::META_ENABLED, isset( $_POST[ SSB_Product::META_ENABLED ] ) ? 'yes' : 'no' );
		$product->update_meta_data( SSB_Product::META_FAMILY, isset( $_POST[ SSB_Product::META_FAMILY ] ) ? sanitize_text_field( wp_unslash( $_POST[ SSB_Product::META_FAMILY ] ) ) : '' );
		foreach ( array( SSB_Product::META_HEIGHT, SSB_Product::META_DIAMETER, SSB_Product::META_CUTOUT ) as $k ) {
			$v = isset( $_POST[ $k ] ) ? absint( wp_unslash( $_POST[ $k ] ) ) : 0;
			$product->update_meta_data( $k, $v ? $v : '' );
		}
		$bx = isset( $_POST[ SSB_Product::META_BASEX ] ) ? trim( wp_unslash( $_POST[ SSB_Product::META_BASEX ] ) ) : '';
		$product->update_meta_data( SSB_Product::META_BASEX, '' === $bx ? '' : (string) max( 0, min( 1, (float) str_replace( ',', '.', $bx ) ) ) );
		// phpcs:enable
	}
}
