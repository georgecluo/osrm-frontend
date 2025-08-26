'use strict';

var L = require('leaflet');
var Geocoder = require('leaflet-control-geocoder');
var LRM = require('leaflet-routing-machine');
var locate = require('leaflet.locatecontrol');
var options = require('./lrm_options');
var links = require('./links');
var leafletOptions = require('./leaflet_options');
var ls = require('local-storage');
var tools = require('./tools');
var state = require('./state');
var localization = require('./localization');
var optimizeControl = require('./optimize');
var createRoutingControl = require('./routing');
require('./polyfill');

var parsedOptions = links.parse(window.location.search.slice(1));
var mergedOptions = L.extend(leafletOptions.defaultState, parsedOptions);
var language = mergedOptions.language;

// load only after language was chosen
var ItineraryBuilder = require('./itinerary_builder')(mergedOptions.language);

var mapLayer = leafletOptions.layer;
var overlay = leafletOptions.overlay;
var baselayer = ls.get('layer') ? mapLayer[0][ls.get('layer')] : leafletOptions.defaultState.layer;
var layers = ls.get('getOverlay') && [baselayer, overlay['Small Components']] || baselayer;
var map = L.map('map', {
  zoomControl: true,
  dragging: true,
  layers: layers,
  maxZoom: 22
}).setView(mergedOptions.center, mergedOptions.zoom);
var OSMRoads = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 22,
  maxNativeZoom: 19
}).addTo(map);

// Pass basemap layers
mapLayer = mapLayer.reduce(function(title, layer) {
  title[layer.label] = L.tileLayer(layer.tileLayer, {
    id: layer.label
  });
  return title;
});

/* Leaflet Controls */
L.control.layers(mapLayer, overlay, {
  position: 'bottomleft'
}).addTo(map);

L.control.scale().addTo(map);

/* Store User preferences */
// store baselayer changes
map.on('baselayerchange', function(e) {
  ls.set('layer', e.name);
});
// store overlay add or remove
map.on('overlayadd', function(e) {
  ls.set('getOverlay', true);
});
map.on('overlayremove', function(e) {
  ls.set('getOverlay', false);
});

/* OSRM setup */
var ReversablePlan = L.Routing.Plan.extend({
  createGeocoders: function() {
    var container = L.Routing.Plan.prototype.createGeocoders.call(this);
    return container;
  }
});

/* Setup markers */
function makeIcon(i, n) {
  var url = 'images/marker-via-icon-2x.png';
  var markerList = ['images/marker-start-icon-2x.png', 'images/marker-end-icon-2x.png'];
  if (i === 0) {
    return L.icon({
      iconUrl: markerList[0],
      iconSize: [20, 56],
      iconAnchor: [10, 28]
    });
  }
  if (i === n - 1) {
    return L.icon({
      iconUrl: markerList[1],
      iconSize: [20, 56],
      iconAnchor: [10, 28]
    });
  } else {
    return L.icon({
      iconUrl: url,
      iconSize: [20, 56],
      iconAnchor: [10, 28]
    });
  }
}

var planOptions = {
  geocoder: L.Control.Geocoder.nominatim(),
  routeWhileDragging: true,
  createMarker: function(i, wp, n) {
    var options = {
      draggable: this.draggableWaypoints,
      icon: makeIcon(i, n)
    };
    var marker = L.marker(wp.latLng, options);
    marker.on('click', function() {
      plan.spliceWaypoints(i, 1);
    });
    return marker;
  },
  routeDragInterval: options.lrm.routeDragInterval,
  addWaypoints: true,
  waypointMode: 'snap',
  position: 'bottomleft',
  useZoomParameter: options.lrm.useZoomParameter,
  reverseWaypoints: true,
  dragStyles: options.lrm.dragStyles,
  geocodersClassName: options.lrm.geocodersClassName,
  geocoderPlaceholder: function(i, n) {
    var startend = [localization.t(language, 'Start - press enter to drop marker'), localization.t(language, 'End - press enter to drop marker')];
    var via = [localization.t(language, 'Via point - press enter to drop marker')];
    if (i === 0) {
      return startend[0];
    }
    if (i === (n - 1)) {
      return startend[1];
    } else {
      return via;
    }
  }
};

var plan = new ReversablePlan([], planOptions);
var plan2 = new ReversablePlan([], planOptions);

var lrmControl = createRoutingControl(plan, leafletOptions, language, mergedOptions, ItineraryBuilder, 'vehicle-1').addTo(map);
var lrmControl2 = createRoutingControl(plan2, leafletOptions, language, mergedOptions, ItineraryBuilder, 'vehicle-2').addTo(map);

var toolsControl = tools.control(localization.get(mergedOptions.language), localization.getLanguages(), options.tools).addTo(map);
var state = state(map, lrmControl, toolsControl, mergedOptions);

var optimizeControl = optimizeControl();
map.addControl(optimizeControl);

plan.on('waypointgeocoded', function(e) {
  if (plan._waypoints.filter(function(wp) { return !!wp.latLng; }).length < 2) {
    map.panTo(e.waypoint.latLng);
  }
});


// add onClick event
map.on('click', function (e){
  addWaypoint(e.latlng);

});
function addWaypoint(waypoint) {
  var length = lrmControl.getWaypoints().filter(function(pnt) {
    return pnt.latLng;
  });
  length = length.length;
  if (!length) {
    lrmControl.spliceWaypoints(0, 1, waypoint);
  } else {
    if (length === 1) length = length + 1;
    lrmControl.spliceWaypoints(length - 1, 1, waypoint);
  }
}

// User selected routes
lrmControl.on('alternateChosen', function(e) {
  var directions = document.querySelectorAll('.leaflet-routing-alt');
  if (directions[0].style.display != 'none') {
    directions[0].style.display = 'none';
    directions[1].style.display = 'block';
  } else {
    directions[0].style.display = 'block';
    directions[1].style.display = 'none';
  }
});

// Route export
lrmControl.on('routeselected', function(e) {
  optimizeControl.clearOptimizedRoute();
  var route = e.route || {};
  var routeCoordinates = (route.coordinates || []).map(function (coordinate) {
    return [coordinate.lng, coordinate.lat];
  });
  optimizeControl.setRouteCoordinates(routeCoordinates);
  var routeGeoJSON = {
    type: 'Feature',
    properties: {
      name: route.name,
      copyright: {
        author: 'OpenStreetMap contributors',
        license: 'http://www.openstreetmap.org/copyright'
      },
      link: {
        href: window.document.location.href,
        text: window.document.title
      },
      time: (new Date()).toISOString()
    },
    geometry: {
      type: 'LineString',
      coordinates: routeCoordinates
    }
  };
  toolsControl.setRouteGeoJSON(routeGeoJSON);
});
plan.on('waypointschanged', function(e) {
  optimizeControl.clearOptimizedRoute();
  if (!e.waypoints ||
      e.waypoints.filter(function(wp) { return !wp.latLng; }).length > 0) {
    toolsControl.setRouteGeoJSON(null);
    optimizeControl.setRouteCoordinates(null);
  }
});

L.control.locate({
  follow: false,
  setView: true,
  remainActive: false,

  keepCurrentZoomLevel: true,
  stopFollowingOnDrag: false,
  onLocationError: function(err) {
    alert(err.message)
  },
  onLocationOutsideMapBounds: function(context) {
    alert(context.options.strings.outsideMapBoundsMsg);
  },
  showPopup: false,
  locateOptions: {}
}).addTo(map);
