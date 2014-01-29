jquery-smokeping-zoom
=====================

jQuery javascript plugin for zooming graphs, standalone.

**Demo:** http://damiencorpataux.github.io/jquery-smokeping-zoom/ (hover the graphs and use your mouse-wheel)

--

**Currently available connectors:**
* smokeping
* cricket
* plain

```
This plugin is currently work-in-progress, sorry for bugs and glitches, issues and patches welcome.
```


### Usage example

Simply load libraries and apply the plugin to the desired graphs img tags, flavoured with plguin options.

```html
<img class="smoke-graph" src="http://oss.oetiker.ch/smokeping-demo/?displaymode=a;start=1390519937;target=Customers.BCP;hierarchy=">

<img class="cricket-graph" src="https://example.com/cgi-bin/cricket/mini-graph.cgi?type=png;target=%2Fsome%2Fpath%2Ftarget;inst=0;dslist=ifSigQSignalNoise;range=86400">

<img class="plain-graph" src="http://example.com/some-standard-service?rrd=rrdfile">


<script type="text/javascript" src="//code.jquery.com/jquery-2.0.3.min.js"></script>
<script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/jquery-mousewheel/3.1.6/jquery.mousewheel.js"></script>
<script type="text/javascript" src="zoom.js"></script>
<script type="text/javascript">
    $( document ).ready(function() {
        $('.smoke-graph').zoomy({connector:'smokeping', zoom_factor:6});
        $('.cricket-graph').zoomy({connector:'cricket', 'maxrange':33053184});
        $('.plain-graph').zoomy({connector:'plain'});
    });
</script>

```
