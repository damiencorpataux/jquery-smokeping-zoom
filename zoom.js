/**
 * Zoomy - jQuery plugin for zooming smokeping graphs, standalone.
 *
 * Global FIXMEs:
 * - When wheeling multiple steps at once, prevent from updating the img at each step
 *   (server load concerns).
 */
(function($) {
    var methods = {
        init: function(options) {
            var data = $.extend({
                // Graph margins (in pixels)
                margin_left: 66,
                margin_right: 30,
                // Data below is updated on img load
                now: null
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
            });
        },
        destroy: function() {
            //FIXME: TODO
        },
        /**
         * Updates plugin data (usually on img 'load' event)
         */
        update_data: function() {
            var data = $(this).data('zoomy');
            data.now = Math.round(new Date().getTime() / 1000);
        },
        wheel: function(event) {
            //FIXME: Get mandatory values for processing
            var $this = $(this),
                timestamp = methods.get_timestamp.call($this, event),
                start = methods.get_start.call($this),
                end = methods.get_end.call($this),
                factor = 2,
                dY = event.deltaY, // 1=up=zoomin
                f = factor * dY;
            // Computes graph new start/end timestamps and updates img.src
            var new_start = Math.round(timestamp - (timestamp-start)/f),
                new_end = Math.round(timestamp - (end-timestamp)/f),
                url = methods.smoke_url.call($this, new_start, new_end);
            console.log(start, end); 
            console.log(new_start, new_end, url);
            $this.attr('src', url);
        },
        /**
         * Creates a new url from the current element.src, by replacing
         * 'start' and 'end' query parameters.
         * This algorythms apply to smoke graphs only, and needs the start/end
         * parameters in the graph url (yet).
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
         * Returns current graph start timestamp
         */
        get_start: function() {
            //FIXME: this could be done with the computing of now,
            //       on image loaded event (same with get_end())
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
         * Returns current graph end timestamp
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
         * Extract the timestamp value of the clicked point
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
            console.log(start, end, x, width);
            // Translates xy to time
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
