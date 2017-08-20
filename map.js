/*
 * Description: Small javascript library built upon d3, which plots
 *              geospatial data and allows limited interaction with it.
 * Author:      Aleksejus Kononovicius (http://kononovicius.lt)
 * URL:         https://github.com/akononovicius/interactive-map
 * License:     WTFPL version 2 (http://www.wtfpl.net/)
 */
class map {
    constructor(wrapperId,dimensions,regionStrokeWidth=[0.5,2],regionStrokeColor=["#fff","#000"],
                mapScalingConstant=1.8,legendForm=[10,550,2,16,2],legendColorForm=[50,10,10,10],
                legendColors=["#fff","#000","rgb(201,223,138)","rgb(54,128,45)","#000"]) {
        this.svg=d3.select("#"+wrapperId).append("svg") // svg in which map is shown (object)
            .attr("class","mapPlot")
            .attr("width",dimensions[0])
            .attr("height",dimensions[1]);
        this.wrapperId=wrapperId; // id of svg elements wrapper
        this.dimensions=dimensions;// size (width, height) of the map in px
        this.curZoomLevel=0;// current zoom level
        this.regionStrokeWidth=regionStrokeWidth;// stroke width for: 0 - normal region, 1 - highlighted region
        this.regionStrokeColor=regionStrokeColor;// stroke color for: 0 - normal region, 1 - highlighted region
        this.mapScalingConstant=mapScalingConstant;// relatively strange constant (influences automatic scaling)
        this.legendForm=legendForm;// 0 - ll x pos, 1 - ll y pos, 2 - strokeWidth, 3 - font size (px), 4 - rounding to multiplier
        this.legendColorForm=legendColorForm;// 0 - width, 1 - height, 2 - x margin, 3 - y margin
        this.legendColors=legendColors;// 0 - background fill, 1 - background stroke, 2 - color scale start, 3 - color scale end, 4 - font color
        this.mapLayer=this.svg.append("g").attr("class","mapLayer");
        this.legendLayer=this.svg.append("g").attr("class","legendLayer");
        this.infoTable=d3.select("#"+this.wrapperId).append("div").attr("class","infoTable");
        this.setupZoomListener();
    }
    /* loading and processing data */
    loadData(url) {
        /*
         * load data from url, which points to json file in GeoJSON format (+ some additional info)
         *
         * Additional info (not present in GeoJSON format):
         * + columnNames - array of strings, which specify index and plotable data stored in
         *   geo object "properties" 
         * + defaultColumnId - integer specifying which of columnNames is plotted on default
         *   (e.g., on load) 
         */
        d3.json(url,this.processData.bind(this));
    }
    processData(error,data) {
        if(error) return console.error(error);
        // get names of columns labeling data
        this.columnNames=data["columnNames"];
        // obtain projection tailored to data
        var projection=this.setupProjection(data);
        // create function to define paths
        var geoPath=d3.geoPath().projection(projection);
        // draw geo features and set their properties
        this.drawGeoPolygons(this.mapLayer,data.features,geoPath);
        // show default data
        this.showData(data["defaultColumnId"]);
        // construct selector for available data
        this.showSelector(data["columnNames"]);
        // listen for clicks
        this.setupClickListener();
    }
    /* show GUI elements */
    showData(columnId) {
        this.columnShownId=columnId;// set id of column that is currently shown
        // extract relevant binded data
        var allData=this.getBindedPropertyById(columnId);
        // get color scale function
        var colorScale=this.getColorScale(allData);
        // set fill color according to color scale function
        this.fillGeoPolygons(this.mapLayer,columnId,colorScale);
        // show legend according to the color scale
        this.showLegend(colorScale);
    }
    showLegend(colorScale) {
        this.removeLegend();
        var legendBgParams=this.showLegendBackground(colorScale);
        this.showLegendForeground(colorScale,legendBgParams);
        this.setLegendWidth();
    }
    showSelector(columnNames) {
        var wrapper=d3.select("#"+this.wrapperId);
        var upperControls=wrapper.insert("div",":first-child").attr("class","upperControls");
        var dataSelector=upperControls.append("select").attr("class","dataSelector");
        var dataColumnNames=columnNames.slice(1);//first is an index, so we need others
        dataSelector.selectAll("option")
            .data(dataColumnNames)
            .enter().append("option")
            .attr("class",function(d,i){
                return "selectorOption"+(i+1);
            })
            .attr("value",function(d,i){
                return i+1;
            })
            .text(function(d,i){
                return d;
            });
        dataSelector.select("#"+this.wrapperId+" .dataSelector option.selectorOption"+(this.columnShownId))
            .attr("selected","selected");// mark default as selected
        var myMap=this;
        dataSelector.on("change",function(){
                myMap.showData(this.value);
            });
    }
    showInfoTable(data=null) {
        this.infoTable.data([data])
            .html(function(d,i){
                if(d===null) return "";
                return "<div><strong>Regionas:</strong> "+d["properties"][this.columnNames[0]]+"</div><div><strong>Vertė:</strong> "+this.getShownValue(d["properties"][this.columnNames[this.columnShownId]])+"</div>";
            }.bind(this));
    }
    /* functions helping to visualize legend */
    showLegendBackground(colorScale) {
        var legendHeight=this.legendColorForm[1]*(2.0*colorScale.range().length+1)
        var legendY=this.legendForm[1]-legendHeight;
        this.legendLayer.append("g")
            .attr("class","legendBgRect")
            .append("rect")
                .attr("x",this.legendForm[0])
                .attr("y",legendY)
                .attr("height",legendHeight)
                .attr("fill",this.legendColors[0])
                .attr("stroke",this.legendColors[1])
                .attr("stroke-width",this.legendForm[2]);
        return {"height":legendHeight,"y":legendY};
    }
    showLegendForeground(colorScale,bgParams) {
        this.showLegendColors(colorScale,bgParams);
        this.showLegendColorLabels(colorScale,bgParams);
    }
    setLegendWidth() {
        // estimate width of the legend based on the legend parameters and actual bounding box of label layer
        var legendTextWidth=d3.select("#"+this.wrapperId+" .legendFgText").node().getBBox()["width"];
        var legendWidth=3.0*this.legendColorForm[2]+this.legendColorForm[0]+legendTextWidth+2;
        this.legendLayer.select("#"+this.wrapperId+" .legendBgRect").select("rect")
            .attr("width",legendWidth);
    }
    removeLegend() {
        this.legendLayer.selectAll("g").remove();
    }
    /* functions helping to visualize foreground of the legend */
    showLegendColors(colorScale,bgParams) {
        var legendFgColors=this.legendLayer.append("g").attr("class","legendFgColors");
        legendFgColors.selectAll("rect")
            .data(colorScale.range().map(function(d){
                    return colorScale.invertExtent(d);
                }))
            .enter().append("rect")
            .attr("class",function(d,i){
                return "legendColorRect legendColorRect"+i;
            })
            .attr("x",this.legendForm[0]+this.legendColorForm[2])
            .attr("y",function(d,i){
                return bgParams["y"]+this.legendColorForm[3]+i*(this.legendColorForm[3]+this.legendColorForm[1]);
            }.bind(this))
            .attr("height",this.legendColorForm[1])
            .attr("width",this.legendColorForm[0])
            .attr("fill",function(d,i){
                return colorScale(d[0]);
            })
            .attr("stroke-width",0);
    }
    showLegendColorLabels(colorScale,bgParams) {
        // estimate quantile bounds
        var i;
        var l=colorScale.quantiles().length+1;
        var legendDataArr=new Array(l);
        /*
         * FUTURE: null could be replaced with known min bound / max bound
         * (this is not the same as min / max of the data)
         */
        legendDataArr[0]=[null,colorScale.quantiles()[0]];
        legendDataArr[l-1]=[colorScale.quantiles()[l-2],null];
        for(i=1;i<l-1;i+=1) {
            legendDataArr[i]=[colorScale.quantiles()[i-1],colorScale.quantiles()[i]];
        }
        // fill text labels using the estimated quantile bounds
        var legendFgText=this.legendLayer.append("g").attr("class","legendFgText");
        legendFgText.selectAll("text")
            .data(legendDataArr)
            .enter().append("text")
            .attr("class",function(d,i){
                return "legendColorLabel legendColorLabel"+i;
            })
            .attr("x",this.legendForm[0]+this.legendColorForm[0]+2.0*this.legendColorForm[2])
            .attr("y",function(d,i) {
                var bH=this.legendForm[1]-bgParams["height"]+this.legendColorForm[1]*0.5+this.legendColorForm[3];
                return bH+2.0*i*this.legendColorForm[3];
            }.bind(this))
            .attr("fill",this.legendColors[4])
            .attr("font-size",this.legendForm[3])
            .attr("dominant-baseline","middle")
            .text(function(d,i){
                return this.getLegendLabelText(d,i);
            }.bind(this));
    }
    getLegendLabelText(data,index) {
        var seg1=this.getShownValue(data[0]);
        var seg2=this.getShownValue(data[1]);
        if(data[0]!==null && data[1]!==null) {
            return "["+seg1+","+seg2+"]";
        }
        if(data[0]===null) {
            return "<"+seg2;
        }
        return seg1+"<";
    }
    getShownValue(val) {
        if(val===null) return null;
        return val.toFixed(this.legendForm[4]);
    }
    /* setup projection */
    setupProjection(data) {
        var params=this.setupProjectionParams(data);
        return d3.geoMercator()
            .center(params["center"])
            .scale(params["scale"])
            .translate([this.dimensions[0]/2,this.dimensions[1]/2]);
    }
    setupProjectionParams(data) {
        // get bounding box
        var bounds=d3.geoBounds(data);
        // estimate size of the bounding box
        var width=d3.geoDistance(bounds[0],[bounds[1][0],bounds[0][1]]);
        var height=d3.geoDistance(bounds[0],[bounds[0][0],bounds[1][1]]);
        // estimate scale of the map
        var scale=Math.min(this.dimensions[0]/width,this.dimensions[1]/height)/this.mapScalingConstant;
        // find center of the bounding box
        var center=[(bounds[0][0]+bounds[1][0])/2.0,(bounds[0][1]+bounds[1][1])/2.0];
        return {"center":center,"scale":scale};
    }
    /* dealing with geo polygons */
    drawGeoPolygons(layer,features,pathFunction) {
        layer.selectAll("path")
            .data(features)
            .enter().append("path")
            .attr("class",function(d,i){
                    return "regionPolygon region"+d["properties"][this.columnNames[0]];
                }.bind(this))
            .attr("d",pathFunction)
            .attr("stroke",this.regionStrokeColor[0])
            .attr("stroke-width",this.regionStrokeWidth[0]/this.currentZoomK);
    }
    fillGeoPolygons(layer,columnId,colorScaleFunction) {
        layer.selectAll("path")
            .attr("fill",function(d,i){
                return colorScaleFunction(d["properties"][this.columnNames[columnId]]);
            }.bind(this));
    }
    drawNormalizedRegions() {
        this.mapLayer.selectAll("path")
            .attr("stroke",this.regionStrokeColor[0])
            .attr("stroke-width",this.regionStrokeWidth[0]/this.currentZoomK);
        this.showInfoTable();
    }
    /* dealing with color scale */
    getColorScale(data) {
        var i,l;
        var colorGenerator=d3.interpolateLab(this.legendColors[2],this.legendColors[3]);
        var colorArr=new Array(5);
        l=colorArr.length;
        for(i=0;i<l;i+=1) {
            colorArr[i]=colorGenerator(i/(l-1));
        }
        return d3.scaleQuantile().domain(data).range(colorArr);
    }
    /* getting binded data */
    getBindedData() {
        return this.mapLayer.selectAll("path").data();
    }
    getBindedPropertyById(columnId) {
        return this.getBindedPropertyByName(this.columnNames[columnId]);
    }
    getBindedPropertyByName(columnName) {
        return this.getBindedData().map(function(d){
                    return d["properties"][columnName];
                }.bind(this));
    }
    /* dealing with map pan and zoom */
    setupZoomListener() {
        this.currentZoomK=1.0;
        var zoom=d3.zoom()
            .scaleExtent([1,18])
            .translateExtent([[0,0],this.dimensions])
            .on("zoom",this.processZoomEvent.bind(this));
        this.svg.call(zoom);
    }
    processZoomEvent() {
        this.currentZoomK=d3.event.transform.k;
        this.drawNormalizedRegions();
        this.mapLayer.attr("transform",d3.event.transform);
    }
    /* dealing with clicks */
    setupClickListener() {
        var myMap=this;
        this.mapLayer.selectAll("path")
            .on("click",function(){
                myMap.processClickEvent(this);
            });
    }
    processClickEvent(region) {
        this.drawNormalizedRegions();
        d3.select(region)
            .attr("stroke",this.regionStrokeColor[1])
            .attr("stroke-width",this.regionStrokeWidth[1]/this.currentZoomK)
            .moveToFront();
        this.showInfoTable(region.__data__);
    }
}
