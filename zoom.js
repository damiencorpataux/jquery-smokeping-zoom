/**
 * Zoomy - jQuery plugin for zooming smokeping graphs, standalone.
 *
 * Author: Damien Corpataux <d@mien.ch>
 *
 * Global FIXMEs:
 * - data.now is not really now: it is the timestamp when the img was loaded,
 *   elaborate doc on that, and check it is a valid design.
 *   Eg, does it work when the graph hasn't been reloaded for 5 minutes ?
 * - IF This plugin reles on QueryString plugin, is there a plugin plugins dependency
 *   system in jQuery ?
 * - When wheeling multiple steps at once, prevent from updating the img at each step
 *   (server load concerns).
 *
 * Global ideas:
 * - We should use ol3 + tilegraph for truly navigating graphs
 */

(function($) {

    /**
     * Plugin methods
     */
    var methods = {

        /**
         * Plugin constructor
         */
        init: function(options) {

            // Default options
            var options = $.extend({
                // Connector to use for url parsing/composition
                connector: 'smokeping',
                // Graph margins (in pixels)
                margin_left: 66,     //FIXME: shall this be in the connector ?
                margin_right: 30,    //       and overridable here ?
                zoom_factor: 2
            }, options);
            // Replaces options.connector string with object
            options.connector = connectors[options.connector];
            // Plugin data object
            var data = $.extend({
                zoom_factor: null,
                connector: null,
                margin_left: null,
                margin_right: null,
                // Data below is updated on img load (see update_data)
                now: null,
                start: null,
                t: this,
                stop: null
            }, options);

            return this.each(function() {
                var $this = $(this);
                if ($this.prop('tagName') != 'IMG') throw ('Element must be an <img>');
                // Setups stuff if the plugin hasn't been initialized yet
                if (!$this.data('zoomy')) $this.data('zoomy', data);
                // Events bindings
                $this.on('load.zoomy', methods.update_data);
                $this.on('mousewheel.zoomy', methods.wheel);
                $this.on('click.zoomy', function(event) {
                    var $this = $(this);
                    var timestamp = methods.get_timestamp.call($this, event);
                    //console.log('Click:', timestamp);
                });
                $this.error(function() {
                    //FIXME: handle image load errors
                    console.log('Image loading error :(');
                });
            });
        },
        destroy: function() {
            //FIXME: TODO
        },

        /**
         * Updates plugin data (usually on img 'load' event).
         */
        update_data: function() {
            var data = $(this).data('zoomy');
            data.now = Math.round($.now() / 1000);
            $.extend(data, data.connector.timespan.call($(this)));
        },

        /**
         * Handles the mouse wheel event
         */
        wheel: function(event) {
            var $this = $(this),
                data = $this.data('zoomy'),
                timestamp = methods.get_timestamp.call($this, event),
                start = data.start,
                end = data.end;
                factor = data.zoom_factor,
                dY = event.deltaY; // wheel delta: 1=up=zoomin, -1=down=zoomout
            // Computes graph new start/end timestamps
            var dST = timestamp-start,
                dTE = end-timestamp,
                f = Math.pow(factor, dY*-1),
                new_start = Math.round(timestamp - dST * f),
                new_end = Math.round(timestamp + dTE * f);
            // Updates img.src
            var url = data.connector.url.call($this, new_start, new_end);
            $this.attr('src', url);
        },

        /**
         * Extract the timestamp value from the occured event
         * (from event x coordinate)
         */
        get_timestamp: function(event) {
            //FIXME: handle the case when graph url has no start and/or end
            //       (test which of start/stop missing combinations are valid)
            var $this = $(this),
                data = $this.data('zoomy'),
                url = $this.attr('src'),
                l = data.margin_left,
                r = data.margin_right;
            // Retrieves start/end params and computes new values
            var now = data.now,
                start = data.start,
                end = data.end;
            // Retrives clicked x position, and size width
            var x = event.pageX - $(this).position().left, //event.offsetX is chrome only
                width = $(this).width();
            // Translates x to time
            var seconds_per_pixel = (end - start) / (width - l - r),
                timestamp = parseInt(start) + Math.round((x - l) * seconds_per_pixel);
            return timestamp;
        },
    };

    /**
     * Plugin entry point
     */
    $.fn.zoomy = function(options) {
        if (methods[options]) {
            // Calls the given method
            return methods[options].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if ( typeof options === 'object' || !options ) {
            // Initilizes plugin
            return methods.init.call(this, options);
        } else {
            // Method not found
            $.error('Method '+options+' does not exist');
        }
    };


    /**
     * Available graph connectors object.
     */ 
    var connectors = {};

    /**
     * Dummy connector for interface specification, and example.
     */
    connectors.dummy = {
        /**
         * Creates and returns a new url from the current element.src,
         * by replacing 'start' and 'end' parameters.
         */
        url: function(start, end) {
            //FIXME: reuse img.src protocol,host,path
            return 'http://www.example.com/image.png?' + $.param({
                start: start,
                end: end
            });
        },
        /**
         * Returns current graph start and end timestamps,
         * usually by parsing the image.src url and/or query string.
         * This algorythms apply to smoke graphs only.
         */
        timespan: function() {
            return {
                start: $.now() - 600,
                end: $.now()
            }
        }
    }

    /**
     * Smokeping graphs connector
     */
    connectors.smokeping = {
        url: function(start, end) {
            var $this = $(this),
                data = $this.data('zoomy'),
                url = $this.attr('src');
            // Returns updated URL
            if (start) {
                if (url.match(/start=/)) url = url.replace(/start=\d*/, 'start='+start);
                else url = url + ';start=' + start;
            }
            if (end) {
                if (url.match(/end=/)) url = url.replace(/end=\d*/, 'end='+end);
                else url = url + ';end=' + end;
            }
            return url;
        },
        timespan: function() {
            //FIXME: shall now be returned if start time is not found in url ?
            //       it feels bizarre, a graph starting now...
            //       poke the smokeping box with url trials to find out
            var $this = $(this),
                data = $this.data('zoomy'),
                url = $this.attr('src'),
                now = data.now,
                start_m = url.match(/start=(\d*)/) || [],
                end_m = url.match(/end=(\d*)/) || [],
                start = start_m.pop() || now,
                end = end_m.pop() || now;
            if (!$.isNumeric(start)) throw ('Could not extract graph start time');
            if (!$.isNumeric(end)) throw ('Could not extract graph end time');
            return {
                start: start,
                end: end
            };
        }
    };

    /**
     * rrdli graphs connector
     */
    connectors.rrdli = {
        url: function(start, end) {
            var $this = $(this),
                data = $this.data('zoomy'),
                url = $this.attr('src');
            // Returns updated URL
            if (url.indexOf('?') == -1) url += '?'
            if (start) {
                if (url.match(/start=/)) url = url.replace(/start=\d*/, 'start='+start);
                else url = url + '&start=' + start;
            }
            if (end) {
                if (url.match(/end=/)) url = url.replace(/end=\d*/, 'end='+end);
                else url = url + '&end=' + end;
            }
            return url;
        },
        timespan: function() {
            //FIXME: what is the rationale with missing start and/or end ?
            var $this = $(this),
                data = $this.data('zoomy'),
                url = $this.attr('src'),
                now = data.now,
                start_m = url.match(/start=(\d*)/) || [],
                end_m = url.match(/end=(\d*)/) || [],
                start = start_m.pop() || now,
                end = end_m.pop() || now;
            if (!start && !end) return {
                // Resets graph to last 600s if no timespan is found
                start: Math.round($.now() / 1000) - 600,
                end: Math.round($.now() / 1000)
            }
            if (!start) return {
                start: Math.round($.now() / 1000) - 600,
                end: end
            }
            // NOTE: an end without a start is impossible by design:
            //       the graph url pattern does not allow it
            //if (!$.isNumeric(start)) throw ('Could not extract graph start time');
            //if (!$.isNumeric(end)) throw ('Could not extract graph end time');
            return {
                start: start,
                end: end
            };
        }
    }
})(jQuery);
