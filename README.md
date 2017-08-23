# Description

A small javascript library built upon d3, which plots geospatial data and allows limited interaction with it. Interaction is limited to panning and zooming (included in d3) as well as selecting which data included in properties is plotted. On click the region is highlighted and additional information about it is shown.

# Usage

Default usage is rather simple just create map object (here "wrapper" is id of wrapping div element)
```javascript
var mapObject=new map.map("wrapper",[width,height]);
```

And submit GeoJSON file URL to be loaded
```javascript
mapObject.loadData("./data/geojson-wgs84.json","index_col",["plottable_1","plottable_2"],"plottable_1");
```
In this example we have chosen to load "geojson-wgs84.json" file, which contains data in GeoJSON format. The code above assumes that each geographical shape has at least three properties: `index_col` (value must be unique), `plottable_1` and `plottable_2` (values must be numeric). When data is loaded and processed the map is plotted and shapes are filled with colors according to respective shapes' `plottable_1` values (fourth parameter). At a later point user would be able to color map based on `plottable_2` values.

# Dependencies

Library depends on d3 v4.

# License

Work done here is rather trivial, so feel free to use it under [WTFPL version 2](http://www.wtfpl.net/).

