# Description

Small javascript library built upon d3, which plots geospatial data and allows limited interaction with it. Interaction is limited to panning and zooming (included in d3) as well as choosing which data included in properties is plotted. On click id and plotted value of clicked region is shown.

# Usage

Default ussage is rather simple just create map object (here "wrapper" is id of wrapping div element)
```javascript
var mapObject=new map.map("wrapper",[width,height]);
```

And submit GeoJSON file URL to be loaded
```javascript
mapObject.loadData("./data/geojson-wgs84.json");
```

GeoJSON file must have the following additional fields:
* "indexColumnName" - string, which specifies unique index (out of available geo object "properties")
* "columnNames" - array of strings, which specify plotable data (out of available geo object "properties")
* "defaultColumnId" - integer specifying which of columnNames is plotted on default (e.g., on load)

When data is loaded and processed default values are plotted.

# Dependencies

Library depends on d3 v4.

# License

Work done here is rather trivial, so feel free to use it under [WTFPL version 2](http://www.wtfpl.net/).

