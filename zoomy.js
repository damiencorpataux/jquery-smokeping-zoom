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
         * Plugin constructor.
         *
         * Options:
         * - connector:    the connector name (string) to use (depending on
         *                 your graph backend)
         * - zoom_factor:  the zoom factor to use when zooming the graph
         * - margin_left,
         * - margin_right: the margins (in pixels) between the image edge and
         *                 the graph canvas edge (used to compute zoom center)
         */
        init: function(options) {

            // Default options
            var options = $.extend({
                // Connector to use for url parsing/composition
                connector: 'plain',
                // Graph margins (in pixels)
                margin_left: 66,     //FIXME: shall this be in the connector ?
                margin_right: 30,    //       and overridable here ?
                zoom_factor: 2
            }, options);
            // Replaces options.connector string with object
            if (!connectors[options.connector])
                throw('Connector not found: '+options.connector)
            else
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
                stop: null
            }, options);

            return this.each(function() {
                var $this = $(this);
                if ($this.prop('tagName') != 'IMG') throw ('Element must be an <img>');
                // Setups stuff if the plugin hasn't been initialized yet
                if (!$this.data('zoomy')) {
                    $this.data('zoomy', data);
                    methods.update_data.call($this);
                }
                // Events bindings
                $this.on('load.zoomy', methods.update_data);
                $this.on('mousewheel.zoomy', methods.wheel);
                $this.on('click.zoomy', function(event) {
                    var $this = $(this);
                    var timestamp = methods.get_timestamp.call($this, event);
                    //console.log('Click:', timestamp);
                });
                $this.error(function() {
                    // Restores last url to prevent a broken image display
                    //FIXME: a better way it to preload the image using
                    // new Image(), listen to its load and error events,
                    // and display if load fired (ie. change displayed img src)
                    // or do not touch the displayed img src if error fired.
                    // This avoid the display glitch between error firing and
                    // last_url loading.
                    var last_url = $(this).data('zoomy').last_url;
                    $(this).attr('src', last_url);
                });
            });
        },
        destroy: function() {
            //FIXME: TODO
        },

        /**
         * Updates plugin data (usually on plugin init and img 'load' event).
         */
        update_data: function() {
            var data = $(this).data('zoomy');
            data.now = Math.round($.now() / 1000);
            $.extend(data, data.connector.timespan.call($(this)));
        },

        /**
         * API Method
         * Updates img url with the given 'start' and 'end' parametes,
         * latching the current url.
         * This is mostly used by error handler to recover last image
         * on load error.
         */
        update: function(start, end, silent) {
            var silent = silent || false,
                $this = $(this),
                data = $this.data('zoomy');
            var url = data.connector.url.call($this, start, end);
            // Triggers custom 'zoom' event
            if (!silent) $this.trigger({
                type: 'zoomy.zoom',
                start: start,
                end: end
            });
            // Updates img src
            var url = data.connector.url.call($this, start, end);
            data.last_url = $this.attr('src');
            $this.attr('src', url);
        },

        /**
         * Handles the mouse wheel event.
         */
        wheel: function(event) {
            event.preventDefault();
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
            methods.update.call($this, new_start, new_end);
        },

        /**
         * Extract the timestamp value from the occured event.
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

        /**
         * API Method
         * Utility function to sync the given elements together.
         * When one element is zoomed, the others are updated
         * with the same timespan.
         */ 
        sync: function(elements) {
            $(elements).on('zoomy.zoom', function(event) {
                // Gets all others synced elements
                var others = $(elements).not($(event.target));
                // Updates synced elements with same start/end (silently)
                others.zoomy('update', event.start, event.end, true);
            });
        }
    };

    /**
     * Plugin entry point.
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
     * Plain graphs connector.
     * This connector uses standard start and end absolute timestamps
     * and standard querystring separator (&).
     */
    connectors.plain = {
        url: function(start, end) {
            var $this = $(this),
                url = $this.attr('src');
            // Returns updated URL
            if (url.match(/start=/)) url = url.replace(/start=\d*/, 'start='+start);
            else url = url + '&start=' + start;
            if (url.match(/end=/)) url = url.replace(/end=\d*/, 'end='+end);
            else url = url + '&end=' + end;
            return url;
        },
        timespan: function() {
            //FIXME: shall now be returned if start time is not found in url ?
            //       it feels bizarre, a graph starting now...
            var $this = $(this),
                url = $this.attr('src'),
                now = $this.data('zoomy').now,
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
     * Smokeping graphs connector.
     * Based on the plain connector, it simply uses semicolons (;) instad of
     * anmpersand (&) as querystring separator.
     */
    connectors.smokeping = {
        url: function(start, end) {
            return connectors.plain.url.call(this, start, end).replace('&', ';');
        },
        //FIXME: timespan(): shall now be returned if start time is not found in url ?
        //       it feels bizarre, a graph starting now...
        //       poke the smokeping box with url trials to find out
        timespan: connectors.plain.timespan
    };
    connectors.smokeping_backup = {
        url: function(start, end) {
            var $this = $(this),
                url = $this.attr('src');
            // Returns updated URL
            if (url.match(/start=/)) url = url.replace(/start=\d*/, 'start='+start);
            else url = url + ';start=' + start;
            if (url.match(/end=/)) url = url.replace(/end=\d*/, 'end='+end);
            else url = url + ';end=' + end;
            return url;
        },
        timespan: function() {
            //FIXME: shall now be returned if start time is not found in url ?
            //       it feels bizarre, a graph starting now...
            //       poke the smokeping box with url trials to find out
            var $this = $(this),
                url = $this.attr('src'),
                now = $this.data('zoomy').now,
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
     * Cricket graphs connector
     * Specific options:
     * - maxrange: specifies the range limit above which the plugin will
     *             not zoom further. Usually, to avoid cricket to return
     *             its error image (since it doesn't send the correct
     *             HTTP status with its response).
     * Notes:
     * - Cricket only takes a 'range' parameter. This limits the plugin
     *   to displaying a graph timespan that ends {now}
     * - When graph generation failed (eg. range too high), cricket doesn't
     *   returns an error HTTP status (eg. 500). This forces the plugin to
     *   implement a maxrange option that prevents from asking problematic
     *   ranges.
     */
    connectors.cricket = {
        url: function(start, end) {
            var $this = $(this),
                data = $this.data('zoomy'),
                now = data.now,
                maxrange = data.maxrange || null,
                url = $this.attr('src');
            // Returns updated URL
            // FIXME: end is ignores, because cricket seems to accept only
            //        a 'range' parameter. Thus seeting graph end time is not
            //        available. To be checked out.
            var range = now - start;
            if (maxrange && range > maxrange) return;
            if (url.match(/range=/)) url = url.replace(/range=\d*/, 'range='+range);
            else url = url + ';range=' + range;
            return url;
        },
        timespan: function() {
            var $this = $(this),
                data = $this.data('zoomy'),
                url = $this.attr('src'),
                now = data.now,
                range_m = url.match(/range=(\d*)/) || [],
                range = range_m.pop(),
                start = now - range,
                end = now;
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
            if (url.match(/start=/)) url = url.replace(/start=\d*/, 'start='+start);
            else url = url + '&start=' + start;
            if (url.match(/end=/)) url = url.replace(/end=\d*/, 'end='+end);
            else url = url + '&end=' + end;
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
