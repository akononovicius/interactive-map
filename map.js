/*
 * Description: Small javascript library built upon d3, which plots
 *              geospatial data and allows limited interaction with it.
 * Author:      Aleksejus Kononovicius (http://kononovicius.lt)
 * URL:         https://github.com/akononovicius/interactive-map
 * License:     WTFPL version 2 (http://www.wtfpl.net/)
 */

/* === Universal Module Definition === */
(function(root,factory){
    if(typeof define==="function" && define.amd) {
        define(["d3"],factory);
    } else if(typeof exports==="object") {
        module.exports=factory(require("d3"));
    } else {
        root.map=factory(root.d3);
    }
}(this,function(d3){
/* =================================== */
    if(typeof(d3.selection.prototype.moveToFront)==="undefined") {
        /*
         * check whether extended function is available
         * if not then add
         */
        d3.selection.prototype.moveToFront = function() {  
            return this.each(function(){
                this.parentNode.appendChild(this);
            });
        };
    }

    class map {
        constructor(wrapperSelector,dimensions=null,regionStrokeWidth=[0.5,2],regionStrokeColor=["#fff","#000"],
                    mapScalingConstant=1.8,legendForm=[10,10,2,16,2],legendColorForm=[50,10,10,10],
                    legendColors=["#fff","#000","rgb(201,223,138)","rgb(54,128,45)","#000"],fillOpacity=1.0) {
            this.wrapper=d3.select(wrapperSelector);// wrap in which all elements are placed (object)
            this.svg=this.wrapper.select("svg"); // svg in which map is shown (object)
            if(this.svg.node()===null) {
                this.svg=this.wrapper.append("svg");
            }
            this.dimensions=dimensions;// size (width, height) of the map in px
            if(this.dimensions!==null) {
                this.svg.attr("width","100%")
                    .attr("height","100%")
                    .attr("viewBox","0 0 "+this.dimensions[0]+" "+this.dimensions[1]);
            }
            this.fillOpacity=fillOpacity;// opacity of region fills
            this.regionStrokeWidth=regionStrokeWidth;// stroke width for: 0 - normal region, 1 - highlighted region
            this.regionStrokeColor=regionStrokeColor;// stroke color for: 0 - normal region, 1 - highlighted region
            this.mapScalingConstant=mapScalingConstant;// relatively strange constant (influences automatic scaling)
            this.legendForm=legendForm;// 0 - ll x pos, 1 - ll y pos, 2 - strokeWidth, 3 - font size (px), 4 - rounding to multiplier
            this.legendColorForm=legendColorForm;// 0 - width, 1 - height, 2 - x margin, 3 - y margin
            this.legendColors=legendColors;// 0 - background fill, 1 - background stroke, 2 - color scale start, 3 - color scale end, 4 - font color
            this.mapLayer=this.svg.append("g").attr("class","mapLayer");
            this.legendLayer=this.svg.append("g").attr("class","legendLayer");
            this.infoTable=this.wrapper.append("div").attr("class","infoTable");
            this.customLegendGenerator=null;// callback for custom function which generates legend (one variable is passed - this map object)
            this.customSelectorGenerator=null;// callback for custom function which generates selector (one variable is passed - this map object)
            this.customColorScaleGenerator=null;// callback for custom function which generates color scale (two variables are passed - this map object and data; function must return d3 color scale)
            this.customInfoLabelGenerator=null;// callback for custom function which generates info labels (two variables are passed - this map object and data; function must return html formatted string)
            this.customProjection=null;// callback for custom projection (two variables are passed - this map object and data; function must return d3 projection)
            this.setupZoomListener();
        }
        /* loading and processing data */
        loadData(url,indexColumnName,columnNames,defaultColumnName,onFinish=null) {
            this.ready=false;// flag which indicates whether everything is prepared for interaction
            d3.json(url,function(error,data){
                if(error) {
                    return console.error(error);
                }
                this.processData(data,indexColumnName,columnNames,defaultColumnName);
                if(onFinish!==null) {
                    onFinish(this);
                }
            }.bind(this));
        }
        processData(data,indexColumnName,columnNames,defaultColumnName) {
            this.columnNames=columnNames;
            this.indexColumnName=indexColumnName;
            // obtain projection tailored to data
            var projection=this.setupProjection(data);
            // create function to define paths
            var geoPath=d3.geoPath().projection(projection);
            // draw geo features and set their properties
            this.drawGeoPolygons(this.mapLayer,data.features,geoPath);
            // show default data
            this.showData(defaultColumnName);
            // construct selector for available data
            this.showSelector();
            // listen for clicks
            this.setupClickListener();
            this.ready=true;// indicate that data was processed and everything is ready for interaction
        }
        /* show GUI elements */
        showData(columnName) {
            this.columnShownName=columnName;// set name of column that is currently shown
            this.columnShownId=this.columnNames.indexOf(columnName);// set id of column that is currently shown
            // extract relevant binded data
            var allData=this.getBindedPropertyByName(columnName);
            // get color scale function
            this.colorScale=this.getColorScale(allData);
            // set fill color according to color scale function
            this.fillGeoPolygons(this.mapLayer,columnName);
            // show legend according to the color scale
            this.showLegend();
            this.setSelector();
        }
        showLegend() {
            this.removeLegend();
            if(typeof this.customLegendGenerator==="function") {
                this.customLegendGenerator(this);
                return;
            }
            var legendBgParams=this.showLegendBackground();
            this.showLegendForeground(legendBgParams);
            this.setLegendWidth();
        }
        showSelector() {
            this.removeSelector();
            if(typeof this.customSelectorGenerator==="function") {
                this.customSelectorGenerator(this);
                return;
            }
            if(this.columnNames.length===0) {
                return;
            }
            var upperControls=this.wrapper.insert("div",":first-child").attr("class","upperControls");
            var dataSelector=upperControls.append("select").attr("class","dataSelector");
            dataSelector.selectAll("option")
                .data(this.columnNames)
                .enter().append("option")
                .attr("class",function(d,i){
                    return "selectorOption"+i;
                })
                .attr("value",function(d,i){
                    return d;
                })
                .text(function(d,i){
                    return this.translateSelectorText(d);
                }.bind(this));
            this.setSelector();
            var myMap=this;
            dataSelector.on("change",function(){
                    myMap.showData(this.value);
                });
        }
        showInfoTable(data=null) {
            this.infoTable.data([data])
                .html(function(d){
                    if(d===null) {
                        return "";
                    }
                    if(typeof this.customInfoLabelGenerator==="function") {
                        return this.customInfoLabelGenerator(this,d);
                    }
                    return "<div><strong>Region:</strong> "+d["properties"][this.indexColumnName]+"</div><div><strong>Value:</strong> "+this.getShownValue(d["properties"][this.columnShownName])+"</div>";
                }.bind(this));
        }
        /* functions helping to visualize selector*/
        removeSelector() {
            this.wrapper.selectAll(".upperControls").remove();
        }
        setSelector() {
            this.wrapper.select("option.selectorOption"+(this.columnShownId))
                .attr("selected","selected");
        }
        translateSelectorText(d) {// override to get nicer selector labels
            return d;
        }
        /* functions helping to visualize legend */
        showLegendBackground() {
            var legendHeight=this.legendColorForm[1]*(2.0*this.colorScale.range().length+1)
            var legendY=this.dimensions[1]-this.legendForm[1]-legendHeight;
            var legendBgRect=this.legendLayer.append("g").attr("class","legendBgRect");
            legendBgRect.append("rect")
                .attr("x",this.legendForm[0])
                .attr("y",legendY)
                .attr("height",legendHeight)
                .attr("fill",this.legendColors[0])
                .attr("stroke",this.legendColors[1])
                .attr("stroke-width",this.legendForm[2]);
            return {"height":legendHeight,"y":legendY};
        }
        showLegendForeground(bgParams) {
            this.showLegendColors(bgParams);
            this.showLegendColorLabels(bgParams);
        }
        setLegendWidth() {
            // estimate width of the legend based on the legend parameters and actual bounding box of label layer
            var legendTextWidth=this.wrapper.select(".legendFgText").node().getBBox()["width"];
            var legendWidth=3.0*this.legendColorForm[2]+this.legendColorForm[0]+legendTextWidth+2;
            this.legendLayer.select(".legendBgRect").select("rect")
                .attr("width",legendWidth);
        }
        removeLegend() {
            this.legendLayer.selectAll("g").remove();
        }
        /* functions helping to visualize foreground of the legend */
        showLegendColors(bgParams) {
            var legendFgColors=this.legendLayer.append("g").attr("class","legendFgColors");
            var data=this.colorScale.range();
            legendFgColors.selectAll("rect")
                .data(data)
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
                    return d;
                })
                .attr("stroke-width",0);
        }
        showLegendColorLabels(bgParams) {
            // estimate bounds
            var i;
            var dcs=null;
            if(typeof this.colorScale.quantiles==="function") {
                dcs=this.colorScale.quantiles();
            } else {
                dcs=this.colorScale.domain();
                dcs=dcs.slice(0,dcs.length-1);
            }
            var l=dcs.length+1;
            var legendDataArr=new Array(l);
            /*
             * FUTURE: null could be replaced with known min bound / max bound
             * (this is not the same as min / max of the data)
             */
            legendDataArr[0]=[null,dcs[0]];
            legendDataArr[l-1]=[dcs[l-2],null];
            for(i=1;i<l-1;i+=1) {
                legendDataArr[i]=[dcs[i-1],dcs[i]];
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
                    var bH=this.dimensions[1]-this.legendForm[1]-bgParams["height"]+this.legendColorForm[1]*0.5+this.legendColorForm[3];
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
            if(val===null) {
                return null;
            }
            return val.toFixed(this.legendForm[4]);
        }
        /* setup projection */
        setupProjection(data) {
            if(typeof this.customProjection==="function") {
                return this.customProjection(this,data);
            }
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
                        return "regionPolygon region"+d["properties"][this.indexColumnName];
                    }.bind(this))
                .attr("d",pathFunction)
                .attr("stroke-linejoin","round")
                .attr("stroke",this.regionStrokeColor[0])
                .attr("stroke-width",this.regionStrokeWidth[0]/this.currentZoomK);
        }
        fillGeoPolygons(layer,columnName) {
            layer.selectAll("path")
                .attr("fill",function(d,i){
                    return this.colorScale(d["properties"][columnName]);
                }.bind(this))
                .attr("fill-opacity",this.fillOpacity);
        }
        drawNormalizedRegions() {
            this.mapLayer.selectAll("path")
                .attr("stroke",this.regionStrokeColor[0])
                .attr("stroke-width",this.regionStrokeWidth[0]/this.currentZoomK);
            this.showInfoTable();
        }
        /* dealing with color scale */
        getColorScale(data) {
            if(typeof this.customColorScaleGenerator==="function") {
                return this.customColorScaleGenerator(this,data);
            }
            var i,l;
            var colorGenerator=d3.interpolateLab(this.legendColors[2],this.legendColors[3]);
            var colorArr=new Array(5);
            l=colorArr.length;
            for(i=0;i<l;i+=1) {
                colorArr[i]=colorGenerator(i/(l-1));
            }
            return d3.scaleQuantile().domain(data).range(colorArr);
        }
        setFixedColorScale(pivots) {
            var i,l;
            var colorGenerator=d3.interpolateLab(this.legendColors[2],this.legendColors[3]);
            var colorArr=new Array(pivots.length);
            l=colorArr.length;
            for(i=0;i<l;i+=1) {
                colorArr[i]=colorGenerator(i/(l-1));
            }
            this.customColorScaleGenerator=function(myMap,data) {
                return d3.scaleThreshold()
                    .domain(pivots).range(colorArr);
            }
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
        setBindedData(columnName,valueArr,defaultValue=null) {
            this.getBindedData().map(function(d){
                var v=valueArr[d["properties"][this.indexColumnName]];
                if(typeof v==="undefined") {
                    if(typeof defaultValue!=="function") {
                        v=defaultValue;
                    } else {
                        v=defaultValue();
                    }
                }
                d["properties"][columnName]=v;
            }.bind(this));
        }
        addPlottedData(columnName,valueArr,defaultValue=null,silent=false) {
            var newColumn=(this.columnNames.indexOf(columnName)===-1);
            if(newColumn) {
                this.columnNames.push(columnName);
            }
            // add or update binded data
            this.setBindedData(columnName,valueArr,defaultValue);
            // if data is added or update and plotted, then update selector
            if(!silent) {//may plot the added data
                this.showData(columnName);
            }
            if(newColumn || !silent) {// if data is new or plotted
                this.showSelector();
            }
        }
        remBindedData(columnName) {
            var id=this.columnNames.indexOf(columnName);
            if(id>-1) {
                this.columnNames.splice(id,1);
                this.showSelector();
            }
        }
        delBindedData(columnName) {
            this.getBindedData().map(function(d){
                delete d["properties"][columnName];
            });
        }
        /* dealing with map pan and zoom */
        setupZoomListener() {
            this.currentZoomK=1.0;
            if(this.dimensions!==null) {
                var zoom=d3.zoom()
                    .scaleExtent([1,18])
                    .translateExtent([[0,0],this.dimensions])
                    .on("zoom",this.processZoomEvent.bind(this));
                this.svg.call(zoom);
            }
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
        /* animation */
        setupAnimation(interval,columnNames,loop=false) {
            var frame=0;
            var lastFrame=columnNames.length;
            var myMap=this;
            this.animationTimer=d3.interval(function(elapsed){
                if(!myMap.ready) {
                    return;
                }
                if(frame>=lastFrame) {
                    if(loop) {
                        frame-=lastFrame;
                    } else {
                        myMap.animationTimer.stop();
                        return;
                    }
                }
                mapObject.showData(columnNames[frame]);
                frame+=1;
            },interval);
        }
    }

/* === Universal Module Definition === */
    return {
        "map":map
    };
}));
/* =================================== */
