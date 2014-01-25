/**
 * Zoomy - jQuery plugin for zooming smokeping graphs, standalone.
 *
 * Global FIXMEs:
 * - When wheeling multiple steps at once, prevent from updating the img at each step
 *   (server load concerns).
 * - Create a minimalistic plugin system to allow switching url connector,
 *   allowing to parse multiple vendors urls (smokeping, nagios, cacti, cricket)
 */
(function($) {
    var methods = {
        init: function(options) {
            var data = $.extend({
                // Graph margins (in pixels)
                zoom_factor: 2,
                margin_left: 66,
                margin_right: 30,
                // Data below is updated on img load
                now: null
                //FIXME: start & end timestamps should also be cached (avoid regexp extraction)
                //       image size could be cached, and used by error handler to avoid img collapse
                //       or simply set the image size at loadtime if not defined by style, point schluss.
            }, options);
            return this.each(function() {
                var $this = $(this);
                if ($this.prop('tagName') != 'IMG') throw ('Element must be an <img>');
                // Setups stuff if the plugin hasn't been initialized yet
                if (!$this.data('zoomy')) $this.data('zoomy', data);
                //FIXME
                // Events bindings
                $this.on('load.zoomy', methods.update_data);
                $this.on('mousewheel.zoomy', methods.wheel);
                $this.on('click.zoomy', function(event) {
                    var $this = $(this);
                    var timestamp = methods.get_timestamp.call($this, event);
                    console.log('Click:', timestamp);
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
            data.now = Math.round(new Date().getTime() / 1000);
        },
        wheel: function(event) {
            var $this = $(this),
                timestamp = methods.get_timestamp.call($this, event),
                start = methods.get_start.call($this),
                end = methods.get_end.call($this),
                factor = $(this).data('zoomy').zoom_factor,
                dY = event.deltaY; // wheel delta: 1=up=zoomin, -1=down=zoomout
            // Computes graph new start/end timestamps
            var dST = timestamp-start,
                dTE = end-timestamp,
                f = Math.pow(factor, dY*-1),
                new_start = Math.round(timestamp - dST * f),
                new_end = Math.round(timestamp + dTE * f);
            // Updates img.src
            var url = methods.smoke_url.call($this, new_start, new_end);
            $this.attr('src', url);
        },
        /**
         * Creates a new url from the current element.src, by replacing
         * 'start' and 'end' query parameters.
         * This algorythms apply to smoke graphs only.
         */
        smoke_url: function(start, end) {
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
        /**
         * Returns current graph start timestamp.
         * This algorythms apply to smoke graphs only.
         */
        get_start: function() {
            //FIXME: shall now be returned if start time is not found in url ?
            //       it feels bizarre, a graph starting now...
            //       poke the smokeping box with url trials to find out
            var $this = $(this),
                data = $this.data('zoomy'),
                url = $this.attr('src'),
                now = data.now,
                start_m = url.match(/start=(\d*)/) || [],
                start = start_m.pop() || now;
            if (!$.isNumeric(start)) throw ('Could not extract graph start time');
            return start;
        },
        /**
         * Returns current graph end timestamp.
         * This algorythms apply to smoke graphs only.
         */
        get_end: function() {
            var $this = $(this),
                data = $this.data('zoomy'),
                url = $this.attr('src'),
                now = data.now,
                end_m = url.match(/end=(\d*)/) || [],
                end = end_m.pop() || now;
            if (!$.isNumeric(end)) throw ('Could not extract graph end time');
            return end;
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
                start = methods.get_start.call($this);
                end = methods.get_end.call($this);
            // Retrives clicked x position, and size width
            var x = event.pageX - $(this).position().left, //event.offsetX is chrome only
                width = $(this).width();
            // Translates x to time
            var seconds_per_pixel = (end - start) / (width - l - r),
                timestamp = parseInt(start) + Math.round((x - l) * seconds_per_pixel);
            return timestamp;
        },
    }
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
})(jQuery);
