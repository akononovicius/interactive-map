# Description

Small javascript library built upon d3, which plots geospatial data and allows limited interaction with it. Interaction is limited to panning and zooming (included in d3) as well as choosing which data included in properties is plotted. On click id and plotted value of clicked region is shown.

# Usage

Default ussage is rather simple just create map object (here "wrapper" is id of wrapping div element)
```javascript
var mapObject=new map("wrapper",[width,height]);
```

And submit GeoJSON file URL to be loaded
```javascript
mapObject.loadData("./data/geojson-wgs84.json");
```

When data is loaded and processed default values are plotted.

GeoJSON file must have two additional fields:
* "columnNames" - array of strings, which specify index and plotable data stored in geo object "properties"
* "defaultColumnId" - integer specifying which of columnNames is plotted on default (e.g., on load)

# License

Work done here is rather trivial, so feel free to use it under [WTFPL](http://www.wtfpl.net/).

# Note on importing d3 library

Note that this library here requires "extended" version of d3 v4.10. You could use [https://github.com/wbkd/d3-extended](https://github.com/wbkd/d3-extended) or alternatively you could import normal d3 and execute the following javascript code before creating map objects
```javascript
d3.selection.prototype.moveToFront = function() {  
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};
```
