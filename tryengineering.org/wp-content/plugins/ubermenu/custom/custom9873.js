/*
*  ubermenu.js
*
*  http://wpmegamenu.com
*
*  Copyright Chris Mavricos, SevenSpark https://sevenspark.com
*/

//Define dependencies first because deferred scripts don't respect document ready order
;var uber_supports = (function() {
	var div = document.createElement('div'),
		vendors = 'Khtml Ms O Moz Webkit'.split(' ');
	return function(prop) {
		var len = vendors.length;
		if ( prop in div.style ) return true;
		prop = prop.replace(/^[a-z]/, function(val) {
			return val.toUpperCase();
		});
		while(len--) {
			if ( vendors[len] + prop in div.style ) {
				return true;
			}
		}
		return false;
	};
})();

function uber_op( id , args , def ){
	//If no id
	if( !ubermenu_data.hasOwnProperty( id ) ){
		return def;
	}
	var val = ubermenu_data[id];
	if( args.hasOwnProperty( 'datatype' ) ){
		switch( args['datatype'] ){
			case 'numeric':
				val = parseInt( val );
				break;

			case 'boolean':
				if( val == 'on' || val == 1 || val == '1' ){
					val = true;
				}
				else{
					val = false;
				}
				break;
		}
	}
	return val;
}

;(function($,sr){
  // debouncing function from John Hann
  // http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
  var debounce = function (func, threshold, execAsap) {
      var timeout;
      return function debounced () {
          var obj = this, args = arguments;
          function delayed () {
              if (!execAsap)
                  func.apply(obj, args);
              timeout = null;
          };
          if (timeout)
              clearTimeout(timeout);
          else if (execAsap)
              func.apply(obj, args);
          timeout = setTimeout(delayed, threshold || 100);
      };
  }
  jQuery.fn[sr] = function(fn){  return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr); };

})(jQuery,'ubersmartresize');

;(function ( $, window, document, undefined ) {
	'use strict';
	var pluginName = "ubermenu",
		defaults = {
			breakpoint: uber_op( 'responsive_breakpoint' , { datatype: 'numeric' } , 959 ),
			touchEvents: true,
			mouseEvents: true,
			retractors: true,
			touchOffClose: uber_op( 'touch_off_close' , {datatype: 'boolean' } , true ), //true,
			submenuIndicatorCloseMobile: uber_op( 'submenu_indicator_close_mobile' , {datatype: 'boolean' } , true ),
			moveThreshold: 10,				//Distance until tap is cancelled in deference to move/scroll
			submenuAnimationDuration: 500,	//ms duration or submenu close time
			ignoreDummies: true,
			clicktest: false,
			windowstest: false,
			debug: false,
			debug_onscreen: false,

			remove_conflicts: uber_op( 'remove_conflicts' , {datatype: 'boolean' } , true ),
			reposition_on_load: uber_op( 'reposition_on_load' , { datatype: 'boolean' } , false ),
			accessible: uber_op( 'accessible' , {datatype: 'boolean' } , true ),
			retractor_display_strategy: uber_op( 'retractor_display_strategy' , {datatype: 'string'}, 'responsive' ),

			intent_delay: uber_op( 'intent_delay' , { datatype: 'numeric' } , 300 ),			//delay before the menu closes
			intent_interval: uber_op( 'intent_interval' , { datatype: 'numeric' } , 100 ),		//polling interval for mouse comparisons
			intent_threshold: uber_op( 'intent_threshold' , { datatype: 'numeric' } , 300 ),	//maximum number of pixels mouse can move to be considered intent

			scrollto_offset: uber_op( 'scrollto_offset' , { datatype: 'numeric' } , 0 ),
			scrollto_duration: uber_op( 'scrollto_duration' , { datatype: 'numeric' } , 1000 ),
			collapse_after_scroll: uber_op( 'collapse_after_scroll' , {datatype:'boolean'}, true ),

			aria_role_navigation: uber_op( 'aria_role_navigation' , {datatype:'boolean' } , false ),
			aria_expanded: uber_op( 'aria_expanded' , {datatype:'boolean'} , false ),
			aria_hidden: uber_op( 'aria_hidden' , {datatype:'boolean'} , false ),
			aria_responsive_toggle: uber_op( 'aria_responsive_toggle' , {datatype:'boolean'} , false ),
			icon_tag: uber_op( 'icon_tag', {datatype:'string'}, 'i' )

		}/*,
		keys = {
			BACKSPACE: 8,
            COMMA: 188,
            DELETE: 46,
            DOWN: 40,
            END: 35,
            ENTER: 13,
            ESCAPE: 27,
            HOME: 36,
            LEFT: 37,
            PAGE_DOWN: 34,
            PAGE_UP: 33,
            PERIOD: 190,
            RIGHT: 39,
            SPACE: 32,
            TAB: 9,
            UP: 38
        }*/;

	// instantiate variables
	// cX, cY = current X and Y position of mouse, updated by mousemove event
	// pX, pY = previous X and Y position of mouse, set by mouseover and polling interval
	var cX, cY, pX, pY;

	function Plugin ( element, options ) {

		var plugin = this;	//reference for all
		this.element = element;
		this.$ubermenu = $( this.element );

		this.orientation = this.$ubermenu.hasClass( 'ubermenu-vertical' ) ? 'v' : 'h';

		this.settings = $.extend( {}, defaults, options );
		this._defaults = defaults;
		this._name = pluginName;
		this.settings.responsive = this.$ubermenu.hasClass( 'ubermenu-responsive' ) ? true : false;

		if( this.settings.debug && this.settings.debug_onscreen ){
			$( 'body' ).append( '<div id="uber-onscreen-debug" style="color:#eee;z-index:10000;background:#222;position:fixed;left:0; bottom:0; width:100%; height:50%; padding:10px;overflow:scroll;"> ' );
			this.debug_target = $( '#uber-onscreen-debug' );
			this.debug_target.on( 'click' , function(){ if( $(this).height() < 100 ) $(this).height( '50%' ); else $(this).height( '50px' ); });
		}
		this.log( '-- START UBERMENU DEBUG --' );

		this.events_disabled = false;
		this.suppress_clicks = false; //Set to true if the mouse events support 'pointerup', which handles both touch and click (but not hover)

		this.touchenabled = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
		if( this.touchenabled ){
			this.$ubermenu.addClass( 'ubermenu-touch' );
		}
		else this.$ubermenu.addClass( 'ubermenu-notouch' );

		if( window.navigator.pointerEnabled ){
			this.touchStart = 'pointerdown';
			this.touchEnd	= 'pointerup';
			this.touchMove	= 'pointermove';

			this.suppress_clicks = true;
		}
		else if( window.navigator.msPointerEnabled ){
			this.touchStart = 'MSPointerDown';
			this.touchEnd	= 'MSPointerUp';
			this.touchMove	= 'MSPointerMove';

			this.suppress_clicks = true;
		}
		else{
			this.touchStart = 'touchstart';
			this.touchEnd	= 'touchend';
			this.touchMove	= 'touchmove';
		}

		this.toggleevent = this.touchEnd == 'touchend' ? this.touchEnd + ' click' : this.touchEnd;	//add click except for IE
		this.transitionend = 'transitionend.ubermenu webkitTransitionEnd.ubermenu msTransitionEnd.ubermenu oTransitionEnd.ubermenu';

		//Are transitions supported?
		this.transitions = uber_supports( 'transition' ) && !this.$ubermenu.hasClass( 'ubermenu-transition-none' );
		if( !this.transitions ) this.$ubermenu.addClass( 'ubermenu-no-transitions' );

		//Detect crappy Android & Windows browsers and disable transitions
		var ua = navigator.userAgent.toLowerCase();
		this.log( ua );

		this.allow_trigger_overrides = true;
		this.noTouchEnd = false;

		var android = this.settings.android = /android/.test( ua );
		var windowsmobile = this.settings.windowsmobile = /iemobile/.test( ua );
		if( android || windowsmobile ){
			//this.log( 'android or windows' );
			//alert( ua );
			if( ( android && !(	/chrome/.test( ua ) || /firefox/.test( ua ) || /opera/.test( ua ) ) ) ||
				( windowsmobile )
				){
				this.settings.touchOffClose = false;
				this.disableTransitions();

				//Crap Android browsers don't fire touchend properly
				if( android && !windowsmobile ){	//adjust to better determine android UA string instead
					this.$ubermenu
						.removeClass( 'ubermenu-trigger-hover_intent' )
						.removeClass( 'ubermenu-trigger-hover' )
						.addClass( 'ubermenu-trigger-click' );
					this.settings.touchEvents = false;
					this.allow_trigger_overrides = false;
				}
			}
		}

		if( windowsmobile ){
			this.log( 'disable touchoff close and accessibility' );
			this.settings.touchOffClose = false;	//improper event delegation in windows
			this.settings.accessible = false;		//WTF Microsoft
			this.settings.mouseEvents = false;
		}

		var safari5 = ( !/chrome/.test( ua ) ) && ( /safari/.test( ua ) ) && ( /version\/5/.test( ua ) );
		if( safari5 ){
			this.disableTransitions();
		}


		//Reflow right items
		this.last_width = window.innerWidth;
		var cur_width = this.last_width;
		var $right_items = plugin.$ubermenu.find( '.ubermenu-item-level-0.ubermenu-align-right' );
		if( $right_items.length ){
			$(window).ubersmartresize( function(){
				cur_width = window.innerWidth;
				if( plugin.last_width <= plugin.settings.breakpoint &&
					cur_width >= plugin.settings.breakpoint ){
					$right_items.hide(); $right_items[0].offsetHeight; $right_items.show(); //reflow
				}
				plugin.last_width = cur_width;
			});
		}

		//TESTING
		if( this.settings.clicktest ) this.touchEnd = 'click';

		this.init();

	}

	Plugin.prototype = {

		init: function () {

			this.log( 'Initializing UberMenu' );

			this.$ubermenu.removeClass( 'ubermenu-nojs' );		//We're off and running

			this.removeConflicts();	//Stop other JS from interfering when possible

			// var plugin = this;
			// $( '.ubermenu a' ).on( 'click touchend mouseenter mouseover mousedown mouseup' , function( e ){
			// 	plugin.log( e.type + ' ' + $(this).text() );
			// });

			//Initialize user interaction events
			this.initializeSubmenuToggleTouchEvents();
			this.initializeSubmenuToggleMouseEvents();
			this.initializeRetractors();
			this.initializeResponsiveToggle();
			this.initializeTouchoffClose();
			this.initializeTabs();
			this.initializeSubmenuPositioning();
			this.initializeSegmentCurrentStates();
			this.initializeAccessibilityOnTab();
			this.initializeAccessibilityStates();
			this.initializeImageLazyLoad();
		},

		removeConflicts: function(){
			if( this.settings.remove_conflicts ){
				this.$ubermenu.find( '.ubermenu-item, .ubermenu-target, .ubermenu-submenu' ).add( this.$ubermenu )
					.removeAttr( 'style' )
					.unbind().off();
			}
		},



		/* Initalizers */

		initializeAccessibilityStates: function(){
			var plugin = this;
			//console.log( this.settings.aria_role_navigation );
			if( this.settings.aria_role_navigation ){
				plugin.$ubermenu.attr('role','navigation');
			}
		},

		initializeAccessibilityOnTab: function(){

			if( !this.settings.accessible ) return;

			var plugin = this;

			//Initialize
			$( 'body' ).on( 'keydown.ubermenu' , function( e ){
				var keyCode = e.keyCode || e.which;
				if( keyCode == 9 ){
					$( 'body' ).off( 'keydown.ubermenu' );
					plugin.initializeAccessibility();
				}
			});

		},

		initializeImageLazyLoad: function(){
			var plugin = this;
			$( '.ubermenu-item-level-0' ).one( 'ubermenuopen' , function(){
				$( this ).find( '.ubermenu-image-lazyload' ).each( function(){
					//Responsive images - add srcset and sizes if present
					if( $( this ).data( 'srcset' ) ){
						$( this )
							.attr( 'srcset' , $( this ).data( 'srcset' ) )
							.attr( 'sizes' , $( this ).data( 'sizes' ) )
					}
					//Whether responsive images (4.4+) or not, set src attribute
					$( this )
						.attr( 'src' , $( this ).data( 'src' ) )
						.removeClass( 'ubermenu-image-lazyload' );
				});
				setTimeout( function(){
					plugin.clearTabSizes();
					plugin.sizeTabs();
				}, 300 );
			});
		},

		initializeAccessibility: function(){

			var plugin = this;
			var tabbables = '.ubermenu-target, a, input, select, textarea';

			plugin.$current_focus = false;
			plugin.mousedown = false;
			plugin.$ubermenu.addClass( 'ubermenu-accessible' );

			//Focus
			plugin.$ubermenu.on( 'focus' , tabbables , function(){

				if( !plugin.mousedown ){

					var $target = $(this);

					plugin.$current_focus = $target;
					var $item = $target.parent( '.ubermenu-item' );	//get the LI parent of A

					if( $item.length ){
						//Top level items - just close everything else
						if( $item.is( '.ubermenu-item-level-0' ) ){
							plugin.closeAllSubmenus();
						}

						//Items with submenus - open the submenus
						if( $item.is( '.ubermenu-has-submenu-drop' ) ){
							//Delay .5s so that if we want we can tab right through
							setTimeout( function(){
								if( !$target.is( ':focus' ) ) return; //skip if item no longer focused

								//Close the submenus of all siblings
								$item.siblings( '.ubermenu-has-submenu-drop' ).each( function(){
									plugin.closeSubmenu( $(this) , 'umac' , plugin );
								});

								//Open this item's submenu
								plugin.openSubmenu( $item, 'umac' , plugin );

							}, 500 );
						}

						//Focusout - any time an element is blurred, check to see if the
						//xUse focusout because it handles blur on all types of child elements
						//plugin.$ubermenu.on( 'focusout' , '.ubermenu-item-level-0' , function(){
						//plugin.$ubermenu.on( 'blur' , tabbables , function(e){
						$target.on( 'blur.ubermenu' , tabbables , function(e){
							if( !plugin.mousedown ){
								plugin.$current_focus = false;
								$(this).off( 'blur.ubermenu' );

								//If a new focus within the menu isn't set within .5s, assume we've left the menu focus
								setTimeout( function(){
									if( !plugin.$current_focus ){
										//console.log( 'abandon ' , plugin.$current_focus );
										plugin.closeAllSubmenus();
									}
								}, 500 );
							}
							plugin.mousedown = false;
						});
					}
				}

				plugin.mousedown = false;

			});

			//Focus leaves UberMenu, close any open submenus
			plugin.$ubermenu.on( 'focusout' , function(){
				setTimeout( function(){
					if( !$( document.activeElement ).closest( plugin.$ubermenu ).length ){
						plugin.closeAllSubmenus();
					}
  			}, 10 );
			});


			//Keyboard interactions - left, right, escape
			plugin.$ubermenu.find( '.ubermenu-item-level-0' ).on( 'keydown' , function(e){
			  //var $uber = jQuery( '.ubermenu' );
			  //console.log( e.which );
			  switch( e.which ){
			      case 39:  //right
			         plugin.closeAllSubmenus();
			         //console.log( 'right ' + jQuery( this ).next().attr('id') );
			         $( this ).next().find( '>.ubermenu-target' ).focus();
			         break;

			      case 37: //left
			         plugin.closeAllSubmenus();
			         //console.log( 'left '+ jQuery( this ).prev().attr('id') );
			         jQuery( this ).prev().find( '>.ubermenu-target' ).focus();
			         break;

			      case 27:  //escape
			         //console.log( 'esc' );
			         //jQuery( this ).find( '.ubermenu-target' ).focus();
			         plugin.closeAllSubmenus();
			         break;
			  }
			});



			//Mousedown - flag a mouse interaction - focus event above will be ignored if focus is result of mouse
			plugin.$ubermenu.on( 'mousedown' , function(e){
				plugin.mousedown = true;
				setTimeout( function(){ plugin.mousedown = false; }, 100 );
			});
		},


		initializeSubmenuPositioning: function(){
			var plugin = this;
			plugin.positionSubmenus();
			$(window).ubersmartresize(function(){
				plugin.positionSubmenus();
			});

			if( this.settings.reposition_on_load ){
				$(window).on( 'load' , function(){
					plugin.positionSubmenus();
				});
			}
		},

		initializeSubmenuToggleTouchEvents: function (){

			if( !this.settings.touchEvents ) return;

			var plugin = this;

			// Custom handle menu in mobile on click redirect to its link ieee-eab
			this.$ubermenu.on( 'tap click touchstart' , '.ubermenu-has-submenu-drop > a > span' , function(e){ 
				e.preventDefault();
				e.stopPropagation();
				plugin.handleLink( e , this.parentNode , plugin );
			} );

			//Touch Events
			//this.$ubermenu.on( this.touchStart , '.ubermenu-item' , function(e){ plugin.handleTouchInteraction( e , this , plugin ); } );

			this.$ubermenu.on( this.touchStart , '.ubermenu-target:not(.shiftnav-toggle)' , function(e){ plugin.handleTouchInteraction( e , this , plugin ); } );
			//this.$ubermenu.on( this.touchEnd ,   '.ubermenu-item' , this.handleSubmenuToggle );			//Added only on touchStart
			//this.$ubermenu.on( this.touchMove ,  '.ubermenu-item' , this.preventInteractionOnScroll );

			//Prevent "Ghost Clicks"
			this.$ubermenu.on( 'click' , '.ubermenu-has-submenu-drop > .ubermenu-target, .ubermenu-tab.ubermenu-item-has-children > .ubermenu-target' , function(e){ plugin.handleClicks( e , this , plugin ); } );



		},

		initializeSubmenuToggleMouseEvents: function( plugin ){

			plugin = plugin || this;	//Assign this to plugin if not passed


			//Don't initialize if mouse events are disabled
			if( !plugin.settings.mouseEvents ) return;
			if( plugin.settings.clicktest ) return;
			if( plugin.settings.windowstest ) return;


			plugin.log( 'initializeSubmenuToggleMouseEvents' );


			var evt = '';
			var trigger = 'hover';
			if( plugin.$ubermenu.hasClass( 'ubermenu-trigger-click' ) ){
				trigger = 'click';
			}
			else if( plugin.$ubermenu.hasClass( 'ubermenu-trigger-hover_intent' ) ){
				trigger = 'hover_intent';
			}

			if( trigger == 'click' ){
				//In the event this device supports 'pointerup', let that event handle the interactions rather than the click event
				if( !this.suppress_clicks ){
					evt = 'click.ubermenu-submenu-toggle';
					//evt = 'mouseup.ubermenu-submenu-toggle';
					this.$ubermenu.on( evt , '.ubermenu-item.ubermenu-has-submenu-drop:not([data-ubermenu-trigger]) > .ubermenu-target' , function(e){ plugin.handleMouseClick( e , this , plugin ); } );
					this.$ubermenu.on( 'click.ubermenu-click-target' , '.ubermenu-item:not(.ubermenu-has-submenu-drop):not([data-ubermenu-trigger]) > .ubermenu-target' , function(e){ plugin.handleLink( e , this , plugin ); } );
				}
			}
			else if( trigger == 'hover_intent' ){
				evt = 'mouseenter.mouse_intent';	// > .ubermenu-target
				this.$ubermenu.on( evt , '.ubermenu-item.ubermenu-has-submenu-drop:not([data-ubermenu-trigger])' , function(e){ plugin.handleMouseIntent( e , this , plugin ); } );
				this.$ubermenu.on( 'click.ubermenu-click-target' , '.ubermenu-item:not([data-ubermenu-trigger]) > .ubermenu-target' , function(e){ plugin.handleLink( e , this , plugin ); } );
			}
			else{
				evt = 'mouseenter.ubermenu-submenu-toggle';
				this.$ubermenu.on( evt , '.ubermenu-item.ubermenu-has-submenu-drop:not([data-ubermenu-trigger]) > .ubermenu-target' , function(e){ plugin.handleMouseover( e , this , plugin ); } );
				this.$ubermenu.on( 'click.ubermenu-click-target' , '.ubermenu-item:not([data-ubermenu-trigger]) > .ubermenu-target' , function(e){ plugin.handleLink( e , this , plugin ); } );
			}

			//Now find divergents
			if( this.allow_trigger_overrides ){
				plugin.$ubermenu.find( '.ubermenu-item[data-ubermenu-trigger]' ).each( function(){

					var $li = $( this );
					trigger = $li.data( 'ubermenu-trigger' );

					if( trigger == 'click' ){
						if( !this.suppress_clicks ){	//hmm
							$li.on( 'click.ubermenu-submenu-toggle' , '.ubermenu-target' , function(e){ plugin.handleMouseClick( e , this , plugin ); } );
						}
					}
					else if( trigger == 'hover_intent' ){
						$li.on( 'mouseenter.mouse_intent' , function(e){ plugin.handleMouseIntent( e , this , plugin ); } );
						//$li.find( '> .ubermenu-target' ).on( 'click.ubermenu-click-target' , function(e){ plugin.handleLink( e , this , plugin ); } );
					}
					//Hover
					else{
						$li.on( 'mouseenter.ubermenu-submenu-toggle' , '.ubermenu-target' , function(e){ plugin.handleMouseover( e , this , plugin ); } );
					}
				});
			}
			else{
				//If trigger overrides aren't allowed, default tabs to click
				plugin.$ubermenu.find( '.ubermenu-tab' ).on( 'click.ubermenu-submenu-toggle' , '.ubermenu-target' , function(e){ plugin.handleMouseClick( e , this , plugin ); } );
			}

			//this.$ubermenu.on( 'mouseout.ubermenu-submenu-toggle'  , '.ubermenu-item' , this.handleMouseout );	//now only added on mouseover
		},

		disableSubmenuToggleMouseEvents: function(){
			this.log( 'disableSubmenuToggleMouseEvents' );
			this.events_disabled = true;
		},


		reenableSubmenuToggleMouseEvents: function( plugin ){
			plugin = plugin || this;

			plugin.log( 'reenableSubmenuToggleMouseEvents' );
			plugin.events_disabled = false;
		},


		initializeRetractors: function() {

			if( !this.settings.retractors ) return;	//Don't initialize if retractors are disabled

			var plugin = this;

			this.$ubermenu.on( 'click' , '.ubermenu-retractor' , function(e){ plugin.handleSubmenuRetractorEnd( e , this , plugin ); } );

			//set up the retractors
			if( this.settings.touchEvents ) this.$ubermenu.on( this.touchStart , '.ubermenu-retractor' , function(e){ plugin.handleSubmenuRetractorStart( e , this , plugin ); } );	// > .ubermenu-target

			//If this device does not support touch interactions, and the strategy is touch, remove the mobile retractors
			if( !this.touchenabled && plugin.settings.retractor_display_strategy == 'touch' ){
				this.$ubermenu.find( '.ubermenu-retractor-mobile' ).remove();
				this.$ubermenu.find( '.ubermenu-submenu-retractor-top' ).removeClass( 'ubermenu-submenu-retractor-top' ).removeClass( 'ubermenu-submenu-retractor-top-2' );
			}

			//Indicator toggles
			if( this.settings.submenuIndicatorCloseMobile ){
				var $target_subs = this.$ubermenu.find( '.ubermenu-has-submenu-drop > .ubermenu-target' )
					.append( '<span class="ubermenu-sub-indicator-close"><'+plugin.settings.icon_tag+' class="fas fa-times"></'+plugin.settings.icon_tag+'></span>' );
				var $indicator_toggles = $target_subs.find( '>.ubermenu-sub-indicator-close' );
				$indicator_toggles.on( 'click' , function(e){
						e.preventDefault();
						e.stopPropagation();
						plugin.closeSubmenuInstantly( $(this).closest( '.ubermenu-item' ) , 'toggleUberMenuSubmenuClosed', plugin );
						return false;
					});
				if( this.settings.touchEvents ){
					$indicator_toggles.on(this.touchStart, function(e){
						e.preventDefault();
						e.stopPropagation();
						plugin.closeSubmenuInstantly( $(this).closest( '.ubermenu-item' ) , 'toggleUberMenuSubmenuClosed', plugin );
						return false;
					});
				}
			}

		},


		initializeResponsiveToggle: function(){
			var plugin = this;
			var toggle_selector = '.ubermenu-responsive-toggle[data-ubermenu-target=' + plugin.$ubermenu.attr('id') + '], .ubermenu-responsive-toggle[data-ubermenu-target=_any_]';
			//if( plugin.$ubermenu.hasClass( 'ubermenu-main' ) ){
			//	toggle_selector+= ', .ubermenu-responsive-toggle[data-ubermenu-target=_main_]';
			//}
			plugin.log( 'initializeResponsiveToggle ' + this.toggleevent );

			//When the window is resized, adjust the toggle visibility ARIA
			if( plugin.settings.aria_responsive_toggle ){
				var hidden = window.innerWidth > plugin.settings.breakpoint;
				$( toggle_selector ).attr( 'aria-hidden' , hidden );
				$(window).ubersmartresize(function(){
					$( toggle_selector ).attr( 'aria-hidden' , ( window.innerWidth > plugin.settings.breakpoint ) );
				});
			}

			$( document ).on( this.toggleevent , toggle_selector ,
				function(e){ plugin.handleResponsiveToggle( e , this , plugin ); } );
		},

		initializeTouchoffClose: function(){

			if( !this.settings.touchOffClose ) return;  //Don't initialize if touch off close is disabled

			var plugin = this;
			$( document ).on( this.touchStart+'.ubermenu_touchoff' , function(e){ plugin.handleTouchoffCloseStart( e, this , plugin ); } );
			$( document ).on( this.touchEnd+'.ubermenu_touchoff' , function(e){ plugin.handleTouchoffClose( e, this , 'touch' , plugin ); } );
			if( !this.suppress_clicks ) $( document ).on( 'mouseup.ubermenu_clickoff' , function(e){ plugin.handleTouchoffClose( e, this , 'click' , plugin ); } ); //use mouseup instead of click for firefox

		},


		initializeTabs: function(){

			var plugin  = this;
			var responsive = plugin.settings.responsive && ( window.innerWidth <= plugin.settings.breakpoint ) ? true : false;

			plugin.$tab_blocks = plugin.$ubermenu.find( '.ubermenu-tabs' );

			//Reverse order so we do the innermost panels first
			plugin.$tab_blocks = $( plugin.$tab_blocks.get().reverse() );

			//When all the images load, check the tabs
			$(window).on( 'load' , function(){
				plugin.sizeTabs();
			});

			//When the window is resized, check the tabs
			plugin.windowwidth = window.innerWidth;
			$(window).ubersmartresize(function(){
				plugin.oldwindowwidth = plugin.windowwidth;
				plugin.windowwidth = window.innerWidth;
				//only run if width has changed
				if( plugin.windowwidth != plugin.oldwindowwidth ){
					plugin.clearTabSizes( plugin );
					plugin.sizeTabs();
					plugin.checkActiveTabs( plugin );
				}
			});

			//When the submenu is opened (first time only), check the tabs
			plugin.$ubermenu.find( '.ubermenu-item-level-0.ubermenu-has-submenu-drop' ).on( 'ubermenuopen.sizetabs' , function(){
				$(this).off( 'ubermenuopen.sizetabs' );
				plugin.sizeTabs();
			});
			//plugin.sizeTabs();

			//Look for dynamically sized tabs, as we need to resize each time we switch tabs
			plugin.$ubermenu.find( '.ubermenu-tabs.ubermenu-tabs-dynamic-sizing' ).on( 'ubermenuopen' , '> .ubermenu-tabs-group > .ubermenu-tab' , function(){
				plugin.sizeTabsDynamic( $(this).closest( '.ubermenu-tabs' ) );
			});

			if( !responsive ){
				plugin.initializeActiveTab( plugin );
			}

		},

		checkActiveTabs: function( plugin ){
			if( window.innerWidth <= plugin.settings.breakpoint ){
				//close all open tabs
				plugin.$tab_blocks.find( '.ubermenu-tab.ubermenu-active' ).removeClass( 'ubermenu-active' );
			}
			else{
				plugin.initializeActiveTab( plugin );
			}
		},

		initializeActiveTab: function( plugin ){

			plugin.$tab_blocks.each( function(){
				var show_default = $(this).hasClass( 'ubermenu-tabs-show-default' );
				var show_current = $(this).hasClass( 'ubermenu-tabs-show-current' );
				var $tabs_group = $(this).find( '> .ubermenu-tabs-group' );

				var tab_shown = false;

				//Current
				if( show_current ){
					//Fill in any ancestor tab gaps
					$tabs_group.find( '.ubermenu-current-menu-item' ).parentsUntil( $tabs_group , '.ubermenu-tab:not( .ubermenu-nocurrent )' ).addClass( 'ubermenu-current-menu-ancestor' );

					//Find any current tabs
					var $current_tab = $tabs_group.find( '> .ubermenu-tab.ubermenu-current-menu-ancestor, > .ubermenu-tab.ubermenu-current-menu-item' );
					if( $current_tab.length ){
						plugin.openSubmenu( $current_tab.first() , 'tab current' , plugin );
						tab_shown = true;
					}
				}

				//Default
				if( show_default && !tab_shown ){
					//If there are no active tabs, activate the first one
					if( $tabs_group.find( '> .ubermenu-tab.ubermenu-active' ).length === 0 ){
						plugin.openSubmenu( $tabs_group.find( '> .ubermenu-tab' ).first() , 'tab default' , plugin );
					}
				}

				//Close all others? .ubermenu( 'closeSubmenu' , $current_tabs.siblings() );

			});
		},

		clearTabSizes: function( plugin ){
			plugin = plugin || this;
			plugin.$ubermenu.find( '.ubermenu-submenu , .ubermenu-tabs , .ubermenu-tab-content-panel , .ubermenu-tabs-group' ).css( 'min-height' , '' );
		},


		sizeTabs: function(){

			var plugin = this;
			var responsive = plugin.settings.responsive && ( window.innerWidth <= plugin.settings.breakpoint ) ? true : false;

			//If this is responsive and we're below the breakpoint, don't size the tabs
			if( responsive ) return;

			plugin.initializeActiveTab( plugin );

			//Do each tabs block
			plugin.$tab_blocks.each( function(){

				//Stacked is if tabs are (a) Layout: Top, (b) Layout: Bottom, (c) Responsive Mode
				var stacked = false;

				if( ( $(this).hasClass( 'ubermenu-tab-layout-top' ) ||
					  $(this).hasClass( 'ubermenu-tab-layout-bottom' ) ) &&
					!responsive ) {

					stacked = true;
				}

				$(this).data( 'um-stacked' , stacked );

				var maxh = 0;


				var $tree;
				if( responsive ){
					$tree = $(this).parentsUntil( '.ubermenu' ).add( $(this).parents( '.ubermenu' ) );
				}
				else{
					$tree = $(this).parentsUntil( '.ubermenu-item-level-0' );
				}
				$tree.addClass( 'ubermenu-test-dimensions' );

				//Find the maximum panel height for this group - only immediate tab panels, not nested
				var $panels = $( this ).find( ' > .ubermenu-tabs-group > .ubermenu-tab > .ubermenu-tab-content-panel' );
				var oh;
				$panels.each( function(){
					$(this).addClass( 'ubermenu-test-dimensions' );
					oh = $(this).outerHeight();	//outerheight
					if( oh > maxh ) maxh = oh;
					$(this).data('um-oh', oh);
					$(this).removeClass( 'ubermenu-test-dimensions' );
				});

				$(this).data( 'um-max-panel-height' , maxh );

				//if( $(this).is( '#menu-item-185' ) ){
				if( $(this).hasClass( 'ubermenu-tabs-dynamic-sizing' ) ){
					plugin.sizeTabsDynamic( $(this) , false );
				}
				else{
					plugin.sizeTabsMax( $(this) );
				}

				$tree.removeClass( 'ubermenu-test-dimensions' );

			});

		},

		sizeTabsMax: function( $tab_block ){

			var maxh = $tab_block.data( 'um-max-panel-height' );
			var stacked = $tab_block.data( 'um-stacked' );
			var $tabsgroup = $tab_block.find( '> .ubermenu-tabs-group' );

			//If left or right layout, set min-height on tabs group as well
			if( !stacked ){
				if( $tabsgroup.outerHeight() > maxh ){
					maxh = $tab_block.outerHeight();
				}
				$tabsgroup.css( 'min-height' , maxh );
			}
			//If top or bottom layout, set height for entire block
			else{
				//console.log( maxh , $tabsgroup.outerHeight() );
				$tab_block.css( 'min-height' , maxh + $tabsgroup.outerHeight() );
			}

			//var $sub = $tab_block.closest( '.ubermenu-submenu-drop' );
			//$sub.css( 'min-height' , false );	//this line does nothing, false is not valid - use '' to unset

			//Set panel heights
			$tabsgroup.find( '> .ubermenu-tab > .ubermenu-tab-content-panel' ).css( 'min-height' , maxh );

		},

		sizeTabsDynamic: function( $tab_block , animate ){

			if( animate === undefined ) animate = true;
			if( animate ){
				animate = $tab_block.hasClass( 'ubermenu-tabs-dynamic-sizing-animate' );
			}

			var plugin = this;
			var responsive = plugin.settings.responsive && ( window.innerWidth <= plugin.settings.breakpoint ) ? true : false;
			if( responsive ) return; //don't size when mobile

			var stacked = $tab_block.data( 'um-stacked' );

			//Look at the tabs group for the active item
			var $tabsgroup = $tab_block.find( '> .ubermenu-tabs-group' );
			var prev_height = $tabsgroup.outerHeight();
			$tabsgroup.css( 'min-height' , '0' );	//reset height
			var $active_panel = $tabsgroup.find( '> .ubermenu-active > .ubermenu-tab-content-panel' );
			var active_oh = $active_panel.data( 'um-oh' );
			var tg_oh = $tabsgroup.outerHeight();
			var maxh = tg_oh > active_oh ? $tab_block.outerHeight() : active_oh;	//get the max height of the tabs group vs active tab

			if( !stacked ){
				if( animate ){
					$tabsgroup.css( 'min-height' , prev_height );
					$tabsgroup.stop().animate( { 'min-height' : maxh } , 300 , 'swing' , function(){
						$active_panel.css( 'overflow' , 'auto' );	//force repaint for background images
					});	//set the tabs group height
				}
				else{
					$tabsgroup.css( 'min-height' , maxh );	//set the tabs group height
				}

			}
			//If top or bottom layout, set height for entire block
			else{
				if( animate ){
					$tab_block.stop().animate( { 'min-height' : maxh + $tabsgroup.outerHeight() } , 300 , 'swing' , function(){
						$active_panel.css( 'overflow' , 'auto' );
					});
				}
				else{
					$tab_block.css( 'min-height' , maxh + $tabsgroup.outerHeight() );
				}
			}
		},

		initializeSegmentCurrentStates: function(){
			this.$ubermenu.find( '.ubermenu-current-menu-item' ).first().parents( '.ubermenu-item:not( .ubermenu-nocurrent )' ).addClass( 'ubermenu-current-menu-ancestor' );
		},

		disableTransitions: function(){
			this.transitions = false;
			this.$ubermenu
					.removeClass( 'ubermenu-transition-slide' )
					.removeClass( 'ubermenu-transition-fade' )
					.removeClass( 'ubermenu-transition-shift' )
					.addClass( 'ubermenu-no-transitions' )
					.addClass( 'ubermenu-transition-none' );
		},



		/* Handlers */

		handleClicks: function( e , a , plugin ){

			var $a = $(a);

			//Kill any clicks flagged by touchend
			if( $a.data( 'ubermenu-killClick' ) ){
				e.preventDefault();
				//e.stopPropagation();
				plugin.log( 'killed click after touchend ', e );
			}

			//Reset flag in any event
			//plugin.log( 'reset kill click' );
			//$a.data( 'ubermenu-killClick' , false );
		},

		handleTouchInteraction: function( e , target , plugin ){

			// e.preventDefault();	//this would stop clicks, but also scroll, which is a problem
			e.stopPropagation();

			//If we're touching Windows, disable transitions
			if( e.type.indexOf( 'pointer' ) >= 0 ) plugin.disableTransitions();

			var $target = $( target );
			//Move to HandleTap
			// $target.data( 'ubermenu-killClick' , true );  //Prevent Clicks from being handled normally
			// $target.data( 'ubermenu-killHover' , true );  //Prevent hover from being handled normally
			// setTimeout( function(){ $target.data( 'ubermenu-killClick' , false ).data( 'ubermenu-killHover' , false ); } , 1000 );
			$target.parent().off( 'mouseleave.mouse_intent_none' );	//don't allow hover intent out if we're touching

			plugin.log( 'touchstart ' + e.type + ' ' + $target.text() , e );

			//Setup touch events
			//plugin.log( 'setup touch events' );
			$target.on( plugin.touchEnd ,  function( e ){ plugin.handleTap( e , this , plugin ); } );
			$target.on( plugin.touchMove , function( e ){ plugin.preventInteractionOnScroll( e , this , plugin ); } );


			//Note original event points for comparison
			//Standard
			if( e.originalEvent.touches ){
				$target.data( 'ubermenu-startX' , e.originalEvent.touches[0].clientX );
				$target.data( 'ubermenu-startY' , e.originalEvent.touches[0].clientY );
			}
			//Microsoft
			else if( e.originalEvent.clientY ){
				var pos = $target.offset();
				//$target.data( 'ubermenu-pos' , pos );
				$target.data( 'ubermenu-startX' , e.originalEvent.clientX );
			 	$target.data( 'ubermenu-startY' , e.originalEvent.clientY );
			}
			// else if( e.changedTouches ){
			// 	$target.data( 'ubermenu-startX' , e.changedTouches[0].pageX );
			// 	$target.data( 'ubermenu-startY' , e.changedTouches[0].pageY );
			// }
		},

		preventInteractionOnScroll: function( e , target , plugin ){

			plugin.log( 'touchmove interaction ' + e.type, e );

			var $target = $( target );

			//Check to see if the touch points were close enough together to be considered a tap
			//If not, they were a move/scroll, so unbind the touch event handlers and don't trigger menu
			if( e.originalEvent.touches ){
				if( Math.abs( e.originalEvent.touches[0].clientX - $target.data( 'ubermenu-startX' ) ) > plugin.settings.moveThreshold ||
					Math.abs( e.originalEvent.touches[0].clientY - $target.data( 'ubermenu-startY' ) ) > plugin.settings.moveThreshold ){
					plugin.log( 'Preventing interaction on scroll, reset handlers (standard)' );
					plugin.resetHandlers( $target , 'preventScroll touches' , plugin );
				}
				else{
					plugin.log( 'diff = ' + Math.abs( e.originalEvent.touches[0].clientY - $target.data( 'ubermenu-startY' ) ) );
				}
			}
			else if( e.originalEvent.clientY ){
				var pos = $target.data( pos );
				if( Math.abs( e.originalEvent.clientX - $target.data( 'ubermenu-startX' ) ) > plugin.settings.moveThreshold ||
					Math.abs( e.originalEvent.clientY - $target.data( 'ubermenu-startY' ) ) > plugin.settings.moveThreshold ){
					plugin.log( 'Preventing interaction on scroll, reset handlers (standard)' );
					plugin.resetHandlers( $target , 'preventScroll client' , plugin );
				}
				else{
					plugin.log( 'diff = ' + e.originalEvent.clientY + ' - ' + $target.data( 'ubermenu-startY' ) + ' = ' + Math.abs( e.originalEvent.clientY - $target.data( 'ubermenu-startY' ) ) );
				}
			}
			/*
			else if( e.changedTouches ){
				if( Math.abs( e.changedTouches[0].pageX - $target.data( 'ubermenu-startX' ) ) > plugin.settings.moveThreshold ||
					Math.abs( e.changedTouches[0].pageY - $target.data( 'ubermenu-startY' ) ) > plugin.settings.moveThreshold ){
					plugin.log( 'Preventing interaction on scroll, reset handlers (Windows)' );
					plugin.resetHandlers( $target );
				}
			}*/
			else plugin.log( 'no touch points found!' );

		},


		/* Handle tap - a touch interaction that completed */
		handleTap: function( e , target , plugin ){

			e.preventDefault();
			e.stopPropagation();

			var $target = $( target ); //.parent();

			//Quit if this was triggered after regular hover (which happens on IE)
			//Kill any touches flagged by mouseenter
			if( $target.data( 'ubermenu-killTouch' ) ){
				plugin.log( 'kill tap' );
				e.preventDefault();
				e.stopPropagation();
			}
			else{

				var $li = $target.parent();

				plugin.log( 'handleTap [' + $target.text() + ']', e.type );

				//$target.data( 'ubermenu-killHover' , true );

				$target.data( 'ubermenu-killClick' , true );  //Prevent Clicks from being handled normally
				$target.data( 'ubermenu-killHover' , true );  //Prevent hover from being handled normally
				setTimeout( function(){ $target.data( 'ubermenu-killClick' , false ).data( 'ubermenu-killHover' , false ); } , 1000 );

				//
				//Close up other submenus before proceeding
				//
				plugin.closeSubmenuInstantly( $li.siblings( '.ubermenu-active' ) );


				//
				//Toggle Submenus
				//

				if( $li.hasClass( 'ubermenu-has-submenu-drop' ) ){

					//if submenu is already open, close it and allow link to be followed
					if( $li.hasClass( 'ubermenu-active' ) ){

						//Don't close tabs, unless we're on mobile
						if( !$li.hasClass( 'ubermenu-tab' ) || window.innerWidth <= plugin.settings.breakpoint ){
							plugin.closeSubmenu( $li , 'toggleUberMenuActive' , plugin );
						}
						console.log('e',e , "target",target , "plugin",plugin);
						//plugin.followLink( e , $li , plugin );
						plugin.handleLink( e , target , plugin , true );
					}
					//if submenu is closed, open the submenu, prevent link from being followed
					else{
						plugin.openSubmenu( $li , 'toggle' , plugin );
					}
				}

				//
				//Follow links that don't have submenus
				//
				else{
					//plugin.followLink( e , $li , plugin );
					plugin.handleLink( e , target , plugin , true );
				}
			}

			//Reset flag in any event
			$target.data( 'ubermenu-killTouch' , false );

			//plugin.resetHandlers( $li );
			//plugin.log( 'reset handlers' );
			plugin.resetHandlers( $target , 'handleTap' , plugin );

		},

		handleTouchAnchorSpans: function( e , target , plugin ){
			console.log(' in touch anchor', plugin);
			let $target = jQuery(target);
			$target.on( plugin.touchEnd ,  function( e ){ plugin.handeLink( e , target , plugin ); } );
			// plugin.handeLink(e, target, plugin);
		},


		handleLink: function( e , link , plugin , follow ){

			follow = follow || false;

			plugin.log( 'handleLink' );

			//e.preventDefault();

			var $link = $( link );

			if( !$link.is( 'a' ) ) return;

			var href = $link.attr( 'href');

			var scrolltarget = $link.data( 'ubermenu-scrolltarget' );

			if( scrolltarget ){

				var $target_el = $( scrolltarget ).first();
				if( $target_el.length > 0 ){
					e.preventDefault();
					$link.trigger( 'ubermenuscrollto' );
					var $li = $link.parent( '.ubermenu-item' );
					$li.addClass( 'ubermenu-current-menu-item' );
					$li.siblings().removeClass( 'ubermenu-current-menu-item' ).removeClass( 'ubermenu-current-menu-parent' ).removeClass( 'uberemnu-current-menu-ancestor' );

					var anim_done = false;
					$( 'html,body' ).animate({
							scrollTop: $target_el.offset().top - plugin.settings.scrollto_offset
						}, plugin.settings.scrollto_duration , 'swing' ,
						function(){
							//after scroll
							if( !anim_done ){
								plugin.closeSubmenu( $link.closest( '.ubermenu-item-level-0' ) , 'handeLink' , plugin );
								if( plugin.settings.collapse_after_scroll && !plugin.$ubermenu.hasClass( 'ubermenu-responsive-nocollapse' ) ) plugin.toggleMenuCollapse( 'toggle' , false , plugin );
								$link.trigger( 'ubermenuscrollto_complete' );
								anim_done = true;
							}
						});
					return false; //don't follow any links if this scroll target is present
				}
				//if target isn't present here, redirect with hash
				else{
					if( href && href.indexOf( '#' ) == -1 ){		//check that hash does not already exist
						if( scrolltarget.indexOf( '#' ) == -1 ){	//if this is a class, add a hash tag
							scrolltarget = '#'+scrolltarget;
						}
						window.location = href + scrolltarget;		//append hash/scroll target to URL and redirect
						e.preventDefault();
					}
					//No href, no worries
				}
			}

			if( !href ){
				e.preventDefault();
			}

			//Handle clicks (where default was already prevented)
			else{

				if( follow && e.isDefaultPrevented() ){
					plugin.log( 'default prevented, follow link' );
					if( $link.attr( 'target' ) == '_blank' ){
						window.open( href , '_blank');
					}
					else{
						window.location = href;
					}
				} // Custom handle menu in mobile on click redirect to its link ieee-eab
				else if($link.parents('li').hasClass('ubermenu-has-submenu-drop')) {
					window.location = href;
				}

			}


		},


		handleMouseClick: function( e , target , plugin ){
			plugin.log( 'handleMouseClick', e );

			//Stop link follow
			//e.preventDefault();	//defer to 'else' so that the second click can be handled naturally

			var $target	= $( target );

			if( $target.data( 'ubermenu-killClick' ) ){
				plugin.log( 'handleMouseClick: killClick' );
				return;	//3.0.4.1
			}

			var $item = $target.parent( '.ubermenu-item' ); //$( li );

			if( $item.length ){
				//Check if this is already open
				if( $item.hasClass( 'ubermenu-active' ) ){

					//If it's a link, follow
					if( $target.is( 'a' ) ){
						plugin.handleLink( e , target , plugin );
					}

					//If it's not a link (and not a tab), retract
					if( !$item.hasClass( 'ubermenu-tab' ) ){
						plugin.closeSubmenu( $item , 'retract' );
					}
				}

				//Close other menus, open this one
				else{

					//Submenu to open
					if( $item.hasClass( 'ubermenu-has-submenu-drop' ) ){
						e.preventDefault(); //Not already active, don't allow click
						plugin.closeSubmenuInstantly( $item.siblings( '.ubermenu-active' ) );
						plugin.openSubmenu( $item , 'click' , plugin );
					}
					//Allow link to be followed
					else{
						//Just let it go
						//plugin.handleLink( e , target , plugin );
					}
				}
			}

			//Only attach mouseout after mouseover, this way menus opened by touch won't be closed by mouseout
			//$( li ).on( 'mouseout.ubermenu-submenu-toggle' , function( e ){ plugin.handleMouseout( e , this , plugin ); } );
		},






		handleMouseIntent: function( e , item , plugin ){	///*target*/

			plugin.log( 'handleMouseIntent' );

			//var $target = $( target );
			//var $item = $target.parent( '.ubermenu-item' );
			var $item = $( item );

			//console.log( '[' + $item.find('> .ubermenu-target').text() + '] handle mouse_intent' );

			//Cancel Timer
			if( $item.data( 'mouse_intent_timer' ) ){
				$item.data( 'mouse_intent_timer' , clearTimeout( $item.data( 'mouse_intent_timer' ) ) );
				//console.log( 'clear timeout' );
			}

			//Prevent Touch events, which will occur on IE
			// var $target = $item.find( '> .ubermenu-target' );
			// $target.data( 'ubermenu-killTouch' , true );
			// setTimeout( function(){ $target.data( 'ubermenu-killTouch' , false ); } , 1000 );

			//Quit if this was triggered by touch
			var $a = $item.find( '.ubermenu-target' );
			//Kill any hovers flagged by touchstart
			if( $a.data( 'ubermenu-killHover' ) ){
				plugin.log( 'killHover MouseIntent' );
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			pX = e.pageX; pY = e.pageY;


			$item.on( 'mousemove.mouse_intent' , plugin.trackMouse );

			$item.data( 'mouse_intent_timer' , setTimeout(
				function(){
					plugin.compare( e , $item , plugin.handleMouseIntentSuccess , plugin );
				},
				plugin.settings.intent_interval
			));

			//Cancel if out - since we only hook up the close submenu event after a successfull intent
			$item.on( 'mouseleave.mouse_intent_none' , function(){
				//plugin.log( 'mouseleave' );
				$(this).data( 'mouse_intent_timer' , clearTimeout( $(this).data( 'mouse_intent_timer' ) ) );
				$item.data( 'mouse_intent_state' , 0 );
				$item.off( 'mouseleave.mouse_intent_none' );

				if( $a.data( 'ubermenu-killHover' ) ){
					plugin.log( 'killHover MouseIntent_Cancel' );
					e.preventDefault();
					e.stopPropagation();
					return;
				}

				plugin.closeSubmenu( $item , 'mouse_intent_cancel' , plugin );
			});
			//}
			//else console.log( 'STATE 1' );


		},

		handleMouseIntentSuccess: function( e , $item , plugin ){

			plugin.log( 'handleMouseIntentSuccess' );

			//Cancel the quickleave event
			$item.off( 'mouseleave.mouse_intent_none' );

			//Quit if this was triggered by touch - on Android Stock, this is triggered after touch, but mouseenter is triggered before
			var $a = $item.find( '.ubermenu-target' );
			//Kill any hovers flagged by touchstart
			if( $a.data( 'ubermenu-killHover' ) ){
				plugin.log( 'Kill hover on IntentSuccess' );
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			//Reset flag in any event
			$a.data( 'ubermenu-killHover' , false );


			plugin.triggerSubmenu( e , $item , plugin );

			//Setup mouseleave, but not for tabs, except below breakpoint
			if( !$item.hasClass( 'ubermenu-tab' ) || window.innerWidth <= plugin.settings.breakpoint ){
				$item.on( 'mouseleave.mouse_intent' , function( e ){ plugin.handleMouseIntentLeave( e , this , plugin ); } );
			}
		},

		handleMouseIntentLeave: function( e , item , plugin ){

			//var $target = $( target );
			//var $item = $target.parent( '.ubermenu-item' );
			var $item = $( item );

			//console.log( '[' + $item.find('> .ubermenu-target').text() + '] handle mouse_intent LEAVE' );

			//Cancel timer
			if( $item.data( 'mouse_intent_timer' ) ){
				$item.data( 'mouse_intent_timer' , clearTimeout( $item.data( 'mouse_intent_timer' ) ) );
				//console.log( 'clear timeout' );
			}

			$item.off( 'mousemove.mouse_intent' , plugin.trackMouse );
			//$item.off( 'mouseleave.mouse_intent' ); //special

			if( $item.data( 'mouse_intent_state' ) == 1 ){
				//$item.data( 'mouse_intent_state' , 0 );
				$item.data( 'mouse_intent_timer' , setTimeout(
					function(){
						plugin.delayMouseLeave( e , $item , plugin.handleMouseIntentLeaveSuccess , plugin );
					},
					plugin.settings.intent_delay
				) );
			}

		},

		handleMouseIntentLeaveSuccess: function( e , $el , plugin ){
			$el.off( 'mouseleave.mouse_intent' ); //special
			if( $el.find( '> .ubermenu-target' ).data( 'ubermenu-killHover' ) ) return;
			plugin.closeSubmenu( $el , 'mouse_intent_leave' , plugin );

		},

		delayMouseLeave: function( e , $el , func , plugin ){
			//console.log( 'delay mouse leave ' );
			$el.data( 'mouse_intent_timer' , clearTimeout( $el.data( 'mouse_intent_timer' ) ) );
			$el.data( 'mouse_intent_state' , 0 );
			return func.apply( $el ,[e,$el,plugin]);
		},

		trackMouse: function( e ) {
			cX = e.pageX;
			cY = e.pageY;
		},

        compare: function( e , $el , func , plugin ){

        	//console.log( 'compare' );

			$el.data( 'mouse_intent_timer' , clearTimeout( $el.data( 'mouse_intent_timer' ) ) );

			// compare mouse positions to see if they've crossed the threshold
			if ( ( Math.abs(pX-cX) + Math.abs(pY-cY) ) < plugin.settings.intent_threshold ) {
				//console.log( 'threshold met' );
				$el.off( 'mousemove.mouse_intent' , plugin.track );
				// set hoverIntent state to true (so mouseOut can be called)
                $el.data( 'mouse_intent_state' , 1 );
                return func.apply( $el , [e,$el,plugin] );
            } else {
            	//console.log( 'keep polling' );
                // set previous coordinates for next time
                pX = cX; pY = cY;
                // use self-calling timeout, guarantees intervals are spaced out properly (avoids JavaScript timer bugs)
                $el.data( 'mouse_intent_timer' , setTimeout( function(){ plugin.compare( e , $el , func , plugin ); } , plugin.settings.intent_interval ) );
            }
        },





        triggerSubmenu: function( e , $item , plugin ){
			plugin.closeSubmenuInstantly( $item.siblings( '.ubermenu-active, .ubermenu-in-transition' ) );
			plugin.openSubmenu( $item , 'mouseenter' , plugin );
        },




		handleMouseover: function( e , target , plugin ){

			if( plugin.events_disabled ) return;

			var $target = $( target );

			$target.data( 'ubermenu-killTouch' , true );
			setTimeout( function(){ $target.data( 'ubermenu-killTouch' , false ); } , 1000 );

			plugin.log( 'handleMouseenter, add mouseleave', e );

			var $item = $target.parent( '.ubermenu-item' ); //$( li );

			if( $item.length ){
				if( !$item.hasClass( 'ubermenu-active' ) ){

					plugin.triggerSubmenu( e , $item , plugin );

					//Set up mouseleave event, but no hover out for Tabs
					if( !$item.hasClass( 'ubermenu-tab' ) || window.innerWidth <= plugin.settings.breakpoint ){
						$item.on( 'mouseleave.ubermenu-submenu-toggle' , function( e ){ plugin.handleMouseleave( e , this , plugin ); } );
					}
				}
			}
		},

		//Mouseleave should be for LI so that we can use subs
		handleMouseleave: function( e , li , plugin ){

			plugin.log( 'handleMouseleave, remove mouseleave', e );

			$( li ).off( 'mouseleave.ubermenu-submenu-toggle' );	//Unbind mouseout event, it'll be rebind next mouseover

			plugin.closeSubmenu( $( li ) , 'mouseout' );
		},



		handleSubmenuRetractorStart: function( e , li , plugin ){
			e.preventDefault();
			e.stopPropagation();

			$( li ).on( plugin.touchEnd , function( e ){ plugin.handleSubmenuRetractorEnd( e , this , plugin ); } );

			plugin.log( 'handleSubmenuRetractorStart ' + $( li ).text());

		},

		handleSubmenuRetractorEnd: function( e , li , plugin ){
			e.preventDefault();
			e.stopPropagation();

			var $parent_item = $( li ).closest( '.ubermenu-item' );
			plugin.closeSubmenu( $parent_item , 'handleSubmenuRetractor' );

			$( li ).off( plugin.touchEnd );

			plugin.log( 'handleSubmenuRetractorEnd ' + $parent_item.find('> .ubermenu-target').text());
			return false;

		},


		handleResponsiveToggle: function( e , toggle , plugin ){

			plugin.log( 'handleResponsiveToggle ' + e.type , e );

			e.preventDefault();
			e.stopPropagation();

			//Prevent Double-fire
			//some browsers fire click and touch, so prevent the click manually
			if( e.type == 'touchend' ){
				plugin.$ubermenu.data( 'ubermenu-prevent-click' , true );
				setTimeout( function(){
					plugin.$ubermenu.data( 'ubermenu-prevent-click' , false );
				}, 500 );
			}
			else if( e.type == 'click' && plugin.$ubermenu.data( 'ubermenu-prevent-click' ) ){
				plugin.$ubermenu.data( 'ubermenu-prevent-click' , false );
				return;
			}

			//TODO just call off/on click.xyz?  or binding already fired?
			//Or should we just have a state set that returns, independent of event type

			plugin.toggleMenuCollapse( 'toggle' , toggle , plugin );

		},

		handleTouchoffCloseStart: function( e , _this , plugin ){
			plugin.touchoffclosestart = $( window ).scrollTop();
		},

		handleTouchoffClose: function( e , _this , eventtype , plugin ){
			//Only fire if the touch event occurred outside the menu AND we've clicked OR we've touched but haven't scrolled
			if( !$(e.target).closest( '.ubermenu' ).length && ( eventtype == 'click' || plugin.touchoffclosestart == $( window ).scrollTop() ) ){

				plugin.log( 'touchoff close ', e );

				//If there are any submenus to close, close them and temporarily disable hover events
				if( plugin.closeAllSubmenus() ){
					//console.log( plugin.settings.submenuAnimationDuration );
					//temporarily disable hovering so that the mouseover event doesn't fire and reopen the menu
					plugin.disableSubmenuToggleMouseEvents();
					window.setTimeout( function(){
							//plugin.initializeSubmenuToggleMouseEvents( plugin );
							plugin.reenableSubmenuToggleMouseEvents( plugin );
						},
						plugin.settings.submenuAnimationDuration );

					//can't call /e.preventDefault(); because it will stop mouseover events from firing
				}
			}
		},




		/* Controllers */

		toggleMenuCollapse: function( action , toggle , plugin ){

			plugin = plugin || this;
			toggle = toggle || '.ubermenu-resposive-toggle';
//console.log( toggle + '[data-ubermenu-target="'+ plugin.$ubermenu.attr( 'id' ) + '"]' );
			var $toggle;
			//Passed regular Object
			if( typeof toggle == 'object' ){
				$toggle = $( toggle );
			}
			//Passed selector string
			else{
				$toggle = $( toggle + '[data-ubermenu-target="'+ plugin.$ubermenu.attr( 'id' ) + '"]');
			}

			action = action || 'toggle';

			if( action == 'toggle' ){
				if( plugin.$ubermenu.hasClass( 'ubermenu-responsive-collapse' ) ){
					action = 'open';
				}
				else{
					action = 'close';
				}
			}

			//plugin.$ubermenu.slideToggle();

			if( action == 'open' ){
				plugin.$ubermenu.removeClass( 'ubermenu-responsive-collapse' );
				$toggle.trigger( 'ubermenutoggledopen' );
				$toggle.toggleClass( 'ubermenu-responsive-toggle-open' );

				if( plugin.settings.aria_responsive_toggle ){
					$toggle.attr( 'aria-pressed' , true );
				}
			}
			else{
				plugin.$ubermenu.addClass( 'ubermenu-responsive-collapse' );
				$toggle.trigger( 'ubermenutoggledclose' );
				$toggle.toggleClass( 'ubermenu-responsive-toggle-open' );

				if( plugin.settings.aria_responsive_toggle ){
					$toggle.attr( 'aria-pressed' , false );
				}
			}
			//plugin.$ubermenu.toggleClass( 'ubermenu-responsive-collapse' );
			//$toggle.trigger( 'ubermenutoggled' );

			if( plugin.transitions && !plugin.$ubermenu.hasClass( 'ubermenu-responsive-nocollapse' ) ){
				plugin.$ubermenu.addClass( 'ubermenu-in-transition' );
				plugin.$ubermenu.on( plugin.transitionend + '_toggleubermenu', function(){
						plugin.$ubermenu.removeClass( 'ubermenu-in-transition' );
						plugin.$ubermenu.off( plugin.transitionend  + '_toggleubermenu' );
					});
			}
		},

		positionSubmenus: function(){

			var plugin = this;
			if( plugin.orientation == 'h' ){
				plugin.$ubermenu.find( '.ubermenu-submenu-drop.ubermenu-submenu-align-center' ).each( function(){

					var $parent = $(this).parent( '.ubermenu-item' );
					var $sub = $(this);
					var $container;
					if( plugin.$ubermenu.hasClass( 'ubermenu-bound' ) ){
						$container = $parent.closest( '.ubermenu , .ubermenu-submenu' ); // main menu bar
					}
					else if( plugin.$ubermenu.hasClass( 'ubermenu-bound-inner' ) ){
						$container = $parent.closest( '.ubermenu-nav , .ubermenu-submenu' ); // inner menu bar
					}
					else{
						var $parent_sub = $parent.closest( '.ubermenu-submenu' );

						//Find the closest relatively positioned element
						if( $parent_sub.length === 0 ){
							$container = plugin.$ubermenu.offsetParent();
							if( !$container ) $container = $( 'body' ); //If no offset parent, assume bounds of body tag
						}
						else{
							$container = $parent_sub;
						}
					}

					var sub_width = $sub.outerWidth();

					var parent_width = $parent.outerWidth();
					var parent_left_edge = $parent.offset().left;

					var container_width = $container.width();
					var container_left_edge = $container.offset().left;

					// console.log( $container );
					// console.log( 'parent_width: ' + parent_width );
					// console.log( 'parent_left: ' + parent_left_edge );
					// console.log( 'container_width: ' + container_width );
					// console.log( 'container_left: ' + container_left_edge );


					var center_left = ( parent_left_edge + ( parent_width / 2 ) ) - ( container_left_edge + ( sub_width / 2 ) );

					//If submenu is left of container edge, align left
					var left = center_left > 0 ? center_left : 0;

					//If submenu width is larger than container width, center to container (menu bar)
					if( sub_width > container_width ){
						left = ( sub_width - container_width ) / -2;
					}
					//If submenu is right of container edge, align right
					else if( left + sub_width > container_width ){
						//left = container_width - sub_width;
						$sub.css( { 'right' : 0 , 'left' : 'auto' } );
						left = false;
					}

					if( left !== false ){
						$sub.css( 'left' , left );
					}
				});
			}
		},


		openSubmenu: function( $li , tag , plugin ){

			plugin = plugin || this;

			plugin.log( 'Open Submenu ' + tag );

			if( !$li.hasClass( 'ubermenu-active' ) ){
				$li.addClass( 'ubermenu-active' );

				//ARIA
				if( plugin.settings.aria_expanded ){
					$li.find( '>.ubermenu-target,>.ubermenu-submenu' ).attr( 'aria-expanded' , 'true' );
				}
				if( plugin.settings.aria_hidden ){
					$li.find( '>.ubermenu-submenu' ).attr( 'aria-hidden' , 'false' );
				}

				if( plugin.transitions ){
					$li.addClass( 'ubermenu-in-transition' );

					$li.find( '> .ubermenu-submenu' ).on( plugin.transitionend + '_opensubmenu', function(){
						plugin.log( 'finished submenu open transition' );
						$li.removeClass( 'ubermenu-in-transition' );
						$( this ).off( plugin.transitionend  + '_opensubmenu' );
					});
				}
				$li.trigger( 'ubermenuopen' );
			}
		},

		closeSubmenu: function( $li , tag , plugin ){

			plugin = plugin || this;

			plugin.log( 'closeSubmenu ' + $li.find( '>a' ).text() + ' [' + tag + ']' );

			//If this menu is currently active and has a submenu, close it
			if( $li.hasClass( 'ubermenu-item-has-children' ) && $li.hasClass( 'ubermenu-active' ) ){

				if( plugin.transitions ){
					$li.addClass( 'ubermenu-in-transition' );	//transition class keeps visual flag until transition completes
				}

				$li.each( function(){
					var _$li = $(this);
					var _$ul = _$li.find( '> .ubermenu-submenu' );

					//Remove the transition flag once the transition is completed
					if( plugin.transitions ){
						_$ul.on( plugin.transitionend + '_closesubmenu', function(){
							plugin.log( 'finished submenu close transition' );
							_$li.removeClass( 'ubermenu-in-transition' );
							_$ul.off( plugin.transitionend  + '_closesubmenu' );
						});
					}
				});
			}

			//Actually remove the active class, which causes the submenu to close
			$li.removeClass( 'ubermenu-active' );
			$li.trigger( 'ubermenuclose' );

			//ARIA
			if( plugin.settings.aria_expanded ){
				$li.find( '>.ubermenu-target,>.ubermenu-submenu' ).attr( 'aria-expanded' , 'false' );
			}
			if( plugin.settings.aria_hidden ){
				$li.find( '>.ubermenu-submenu' ).attr( 'aria-hidden' , 'true' );
			}

		},

		//Close subs without transition
		closeSubmenuInstantly: function( $li ){
			if( $li.length === 0 ) return;
			var plugin = this;
			$li.addClass( 'ubermenu-notransition' );
			$li.removeClass( 'ubermenu-active' ).removeClass( 'ubermenu-in-transition' );
			$li[0].offsetHeight;	//triggers reflow
			$li.removeClass( 'ubermenu-notransition' );
			$li.trigger( 'ubermenuclose' );

			//ARIA
			if( plugin.settings.aria_expanded ){
				$li.find( '>.ubermenu-target,>.ubermenu-submenu' ).attr( 'aria-expanded' , 'false' );
			}
			if( plugin.settings.aria_hidden ){
				$li.find( '>.ubermenu-submenu' ).attr( 'aria-hidden' , 'true' );
			}
		},

		//Top level subs only
		closeAllSubmenus: function(){
			//$( this.element ).find( 'li.menu-item-has-children' ).removeClass( 'ubermenu-active' );
			var $actives = this.$ubermenu.find( '.ubermenu-item-level-0.ubermenu-active' );
			if( $actives.length ) this.closeSubmenuInstantly( $actives );
			return $actives.length;
		},

		resetHandlers: function( $target , tag , plugin ){
			plugin.log( 'ResetHandlers: ' + tag );
			$target.off( this.touchEnd );
			$target.off( this.touchMove );

			var $item = $target.parent();
			$item.off( 'mousemove.mouse_intent' );
			$item.off( 'mouseleave.mouse_intent_none' );
			$item.data( 'mouse_intent_timer' , clearTimeout( $item.data( 'mouse_intent_timer' ) ) );
			$item.data( 'mouse_intent_state' , 0 );
		},


		log: function( content , o , plugin ){
			plugin = plugin || this;

			if( plugin.settings.debug ){
				if( plugin.settings.debug_onscreen ){
					this.debug_target.prepend( '<div class="um-debug-content">'+content+'</div>' );
				}
				else console.log( content , o );
			}
		}
	};

	/*
	$.fn[ pluginName ] = function ( options ) {
		return this.each(function() {
			if ( !$.data( this, "plugin_" + pluginName ) ) {
				$.data( this, "plugin_" + pluginName, new Plugin( this, options ) );
			}
		});
	};
	*/

	$.fn[ pluginName ] = function ( options ) {

		var args = arguments;

		if ( options === undefined || typeof options === 'object' ) {
			return this.each(function() {
				if ( !$.data( this, "plugin_" + pluginName ) ) {
					$.data( this, "plugin_" + pluginName, new Plugin( this, options ) );
				}
			});
		}
		else if ( typeof options === 'string' && options[0] !== '_' && options !== 'init') {
			// Cache the method call to make it possible to return a value
			var returns;

			this.each(function () {
				var instance = $.data(this, 'plugin_' + pluginName);

				// Tests that there's already a plugin-instance and checks that the requested public method exists
				if ( instance instanceof Plugin && typeof instance[options] === 'function') {

					// Call the method of our plugin instance, and pass it the supplied arguments.
					returns = instance[options].apply( instance, Array.prototype.slice.call( args, 1 ) );
				}

				// Allow instances to be destroyed via the 'destroy' method
				if (options === 'destroy') {
					$.data(this, 'plugin_' + pluginName, null);
				}
			});

			// If the earlier cached method gives a value back return the value, otherwise return this to preserve chainability.
			return returns !== undefined ? returns : this;
		}
	};

})( jQuery, window, document );



(function($){

	var ubermenu_is_initialized = false;

	//jQuery( document ).ready( function($){
	jQuery(function($) {
		initialize_ubermenu( 'document.ready' );
	});

	//Backup
	$( window ).on( 'load' , function(){
		initialize_ubermenu( 'window.load' );
	});

	function initialize_ubermenu( init_point ){

		if( ubermenu_is_initialized ) return;

		ubermenu_is_initialized = true;

		if( ( typeof console != "undefined" ) && init_point == 'window.load' ) console.log( 'Notice: UberMenu initialized via ' + init_point + '.  This indicates that an unrelated error on the site prevented it from loading via the normal document ready event.' );

		//Scroll to non-ID "hashes"
		if( window.location.hash.substring(1,2) == '.' ){
			var $scrollTarget = $( 'body' ).find( window.location.hash.substring(1) );
			if( $scrollTarget.length ) window.scrollTo( 0 , $scrollTarget.offset().top - ubermenu_data.scrollto_offset );
		}
		//Make sure offset is applied to normal hashes
		else if( window.location.hash.length ){
			setTimeout( function(){
				try{
					var $scrollTarget = $( 'body' ).find( window.location.hash );
					if( $scrollTarget.length ) window.scrollTo( 0 , $scrollTarget.offset().top - ubermenu_data.scrollto_offset  );
				}
				catch(error){
					//not an element identifier, don't scroll
				}
			}, 100 );
		}


		//Clean out empty items left by unbalanced dynamic items
		$( '.ubermenu-item:empty' ).each( function(){			//find all empty items
		  var $p = $(this).parent();											//get parent UL
		  $(this).remove();																//remove the empty item
		  if( $p.find( '.ubermenu-item' ).length == 0 ){	//if this submenu is now empty (no items)
				//remove submenu classes, remove submenu
		    $p.parent().removeClass( 'ubermenu-has-submenu-drop' ).removeClass( 'ubermenu-has-submenu-flyout' ).off().find('.ubermenu-target > .ubermenu-sub-indicator').remove();
		    $p.remove();
		  }
		});


		$( '#wp-admin-bar-ubermenu_loading' ).remove();

		$( '.ubermenu' ).ubermenu({
			//touchOffClose: false
			//debug: true
			//debug_onscreen: true
			//mouseEvents: false
			//clicktest: true
		});


		//Google Maps
		if(
			typeof google !== 'undefined' &&
			typeof google.maps !== 'undefined' &&
			typeof google.maps.LatLng !== 'undefined') {
				$('.ubermenu-map-canvas').each(function(){

					var $canvas = $( this );
					var dataZoom = $canvas.attr('data-zoom') ? parseInt( $canvas.attr( 'data-zoom' ) ) : 8;

					var latlng = $canvas.attr('data-lat') ?
									new google.maps.LatLng($canvas.attr('data-lat'), $canvas.attr('data-lng')) :
									new google.maps.LatLng(40.7143528, -74.0059731);

					var myOptions = {
						zoom: dataZoom,
						mapTypeId: google.maps.MapTypeId.ROADMAP,
						center: latlng
					};

					var map = new google.maps.Map(this, myOptions);

					if($canvas.attr('data-address')){
						var geocoder = new google.maps.Geocoder();
						geocoder.geocode({
								'address' : $canvas.attr('data-address')
							},
							function(results, status) {
								if (status == google.maps.GeocoderStatus.OK) {
									map.setCenter(results[0].geometry.location);
									latlng = results[0].geometry.location;
									var marker = new google.maps.Marker({
										map: map,
										position: results[0].geometry.location,
										title: $canvas.attr('data-mapTitle')
									});
								}
						});
					}
					else{
						//place marker for regular lat/long
						var marker = new google.maps.Marker({
							map: map,
							position: latlng,
							title: $canvas.attr('data-mapTitle')
						});
					}

					var $li = $(this).closest( '.ubermenu-has-submenu-drop' );
					var mapHandler = function(){
						google.maps.event.trigger(map, "resize");
						map.setCenter(latlng);
						map.setZoom(dataZoom);
						//Only resize the first time we open
						$li.off( 'ubermenuopen', mapHandler );
					};
					$li.on( 'ubermenuopen', mapHandler );
				});
		}
	}

})(jQuery);


/*
 * Deprecated API Functions
 */
//jQuery( '.ubermenu' ).ubermenu( 'openSubmenu' , jQuery( '#menu-item-401' ) );
function uberMenu_openMega( id ){
	jQuery( '.ubermenu' ).ubermenu( 'openSubmenu' , jQuery( id ) );
}
function uberMenu_openFlyout( id ){
	jQuery( '.ubermenu' ).ubermenu( 'openSubmenu' , jQuery( id ) );
}
function uberMenu_close( id ){
	jQuery( '.ubermenu' ).ubermenu( 'closeSubmenu' , jQuery( id ) );
}
function uberMenu_redrawSubmenus(){
	jQuery( '.ubermenu' ).ubermenu( 'positionSubmenus' );
}
