Small javascript library built upon d3, which plots geospatial data and allows limited interaction with it.

Default ussage is rather simple just create object
```javascript
var mapObject=new map("wrapper",[width,height]);
```
and submit GeoJSON file URL to be loaded
```javascript
mapObject.loadData("./data/geojson-wgs84.json");
```

GeoJSON file must have two additional fields:
* "columnNames" - array of strings, which specify index and plotable data stored in geo object "properties"
* "defaultColumnId" - integer specifying which of columnNames is plotted on default (e.g., on load)

# Note on importing d3 library

Note that this library here requires "extended" version of d3 v4.10. You could use [https://github.com/wbkd/d3-extended](https://github.com/wbkd/d3-extended). Alternatively you could import normal d3, e.g., by adding the following to the head of your html file
```html
<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/d3/4.10.0/d3.min.js"></script>
```
and execute the following javascript code before creating map objects
```javascript
d3.selection.prototype.moveToFront = function() {  
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};
```
