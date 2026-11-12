<?php
defined( 'ABSPATH' ) || exit;

/** Tab „Simulator brad” în Date produs (editare produs). */
class SSB_Admin {

	public static function init() {
		add_filter( 'woocommerce_product_data_tabs', array( __CLASS__, 'tab' ) );
		add_action( 'woocommerce_product_data_panels', array( __CLASS__, 'panel' ) );
		add_action( 'woocommerce_admin_process_product_object', array( __CLASS__, 'save' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		// Media: permitem încărcarea modelelor 3D (.glb / .usdz) — doar pentru cine editează produse.
		add_filter( 'upload_mimes', array( __CLASS__, 'mimes' ) );
		add_filter( 'wp_check_filetype_and_ext', array( __CLASS__, 'check_model' ), 10, 4 );
	}

	const MODEL_MIMES = array( 'glb' => 'model/gltf-binary', 'usdz' => 'model/vnd.usdz+zip' );

	public static function mimes( $m ) {
		return current_user_can( 'edit_products' ) ? array_merge( $m, self::MODEL_MIMES ) : $m;
	}

	/** WordPress verifică și conținutul fișierului; .glb/.usdz nu sunt recunoscute, așa că le validăm noi după antet. */
	public static function check_model( $data, $file, $filename, $mimes ) {
		$ext = strtolower( pathinfo( (string) $filename, PATHINFO_EXTENSION ) );
		if ( ! empty( $data['type'] ) || ! isset( self::MODEL_MIMES[ $ext ] ) || ! current_user_can( 'edit_products' ) || ! is_readable( $file ) ) {
			return $data;
		}
		$head = (string) file_get_contents( $file, false, null, 0, 4 ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$ok   = 'glb' === $ext ? 'glTF' === $head : "PK\x03\x04" === $head; // .usdz = arhivă zip
		if ( $ok ) {
			$data['ext']             = $ext;
			$data['type']            = self::MODEL_MIMES[ $ext ];
			$data['proper_filename'] = false;
		}
		return $data;
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
  // modele 3D (.glb / .usdz)
  $(document).on('click', '.ssb-model-pick', function(e){
    e.preventDefault();
    var key = $(this).data('key'), ext = $(this).data('ext');
    var f = wp.media({ title: 'Model 3D (.' + ext + ')', button: { text: 'Folosește fișierul' }, multiple: false });
    f.on('select', function(){
      var a = f.state().get('selection').first().toJSON(), n = (a.filename || a.url || '').toLowerCase();
      if (n.slice(-ext.length - 1) !== '.' + ext) { alert('Alege un fișier .' + ext); return; }
      $('#' + key).val(a.id); $('#' + key + '_name').text(a.filename || a.url);
    });
    f.open();
  });
  $(document).on('click', '.ssb-model-clear', function(e){ e.preventDefault(); var k = $(this).data('key'); $('#' + k).val(''); $('#' + k + '_name').text('—'); });
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
		echo '</div><div class="options_group">';
		self::model_field( $id, SSB_Product::META_GLB, 'glb', 'Model 3D (.glb)', 'Bradul 3D pentru vederea 3D și AR pe Android. Poate lipsi la unele înălțimi – se folosește modelul altei înălțimi, scalat.' );
		self::model_field( $id, SSB_Product::META_USDZ, 'usdz', 'Model 3D iPhone (.usdz)', 'Același brad pentru AR pe iPhone (AR Quick Look). iPhone-ul nu poate scala modelul, deci fiecare înălțime are nevoie de fișierul ei; fără el, butonul AR nu apare pe iPhone la această înălțime.' );
		echo '</div></div>';
	}

	private static function model_field( $id, $key, $ext, $label, $tip ) {
		$att  = absint( get_post_meta( $id, $key, true ) );
		$file = $att ? get_attached_file( $att ) : '';
		echo '<p class="form-field"><label>' . esc_html( $label ) . '</label>';
		echo '<input type="hidden" id="' . esc_attr( $key ) . '" name="' . esc_attr( $key ) . '" value="' . esc_attr( $att ? $att : '' ) . '">';
		echo '<button type="button" class="button ssb-model-pick" data-key="' . esc_attr( $key ) . '" data-ext="' . esc_attr( $ext ) . '">Alege fișierul</button> ';
		echo '<button type="button" class="button-link ssb-model-clear" data-key="' . esc_attr( $key ) . '">Șterge</button>';
		echo wc_help_tip( $tip ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '<code id="' . esc_attr( $key ) . '_name" style="display:block;margin-top:6px;width:max-content;max-width:100%">' . esc_html( $file ? wp_basename( $file ) : '—' ) . '</code></p>';
	}

	/** @param WC_Product $product */
	public static function save( $product ) {
		// phpcs:disable WordPress.Security.NonceVerification.Missing -- nonce-ul e verificat de WooCommerce la salvarea produsului.
		$product->update_meta_data( SSB_Product::META_ENABLED, isset( $_POST[ SSB_Product::META_ENABLED ] ) ? 'yes' : 'no' );
		$product->update_meta_data( SSB_Product::META_FAMILY, isset( $_POST[ SSB_Product::META_FAMILY ] ) ? sanitize_text_field( wp_unslash( $_POST[ SSB_Product::META_FAMILY ] ) ) : '' );
		foreach ( array( SSB_Product::META_HEIGHT, SSB_Product::META_DIAMETER, SSB_Product::META_CUTOUT, SSB_Product::META_GLB, SSB_Product::META_USDZ ) as $k ) {
			$v = isset( $_POST[ $k ] ) ? absint( wp_unslash( $_POST[ $k ] ) ) : 0;
			$product->update_meta_data( $k, $v ? $v : '' );
		}
		$bx = isset( $_POST[ SSB_Product::META_BASEX ] ) ? trim( wp_unslash( $_POST[ SSB_Product::META_BASEX ] ) ) : '';
		$product->update_meta_data( SSB_Product::META_BASEX, '' === $bx ? '' : (string) max( 0, min( 1, (float) str_replace( ',', '.', $bx ) ) ) );
		// phpcs:enable
	}
}
