'use strict';

var L = require('leaflet');
var localization = require('./localization');
var leafletOptions = require('./leaflet_options');
var language = leafletOptions.defaultState.language;

// Custom control to trigger the trajectory optimizer
var OptimizeControl = L.Control.extend({
  options: {
    position: 'bottomright'
  },

  initialize: function(options) {
    L.Control.prototype.initialize.call(this, options);
    this._routeCoordinates = null;
    this._optimizedPolyline = null;
  },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    var button = L.DomUtil.create('a', 'leaflet-control-optimize', container);
    this._button = button;
    button.title = localization.t(language, 'Optimize Trajectory') || 'Optimize Trajectory';

    // Create span for the sparkle icon
    var sparkleSpan = L.DomUtil.create('span', 'sparkle-icon', button);
    sparkleSpan.innerHTML = '&#x2728;'; // Sparkle icon

    // Create span for the text
    var textSpan = L.DomUtil.create('span', 'optimize-text', button);
    textSpan.innerHTML = ' ' + (localization.t(language, 'Optimize Trajectory') || 'Optimize Trajectory');

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(button, 'click', L.DomEvent.stop);
    L.DomEvent.on(button, 'click', this._optimize, this);

    this._disable();

    return container;
  },

  _optimize: function() {
    var coordinates = this._routeCoordinates;

    if (!coordinates || coordinates.length < 2) {
      alert(localization.t(language, 'Please generate a route first to optimize a trajectory.') || 'Please generate a route first to optimize a trajectory.');
      return;
    }

    fetch(leafletOptions.trajectoryOptimizerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: coordinates }),
    })
    .then(function(response) {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(function(data) { // Note: `this` is bound to the control here
      var optimizedWaypoints = data.optimized_coordinates.map(function(coord) { return L.latLng(coord[1], coord[0]); });

      if (this._optimizedPolyline) {
        this._map.removeLayer(this._optimizedPolyline);
      }

      this._optimizedPolyline = L.polyline(optimizedWaypoints, {
        color: 'green',
        weight: 5,
        opacity: 0.8
      }).addTo(this._map);
    }.bind(this))
    .catch(function(error) {
      console.error('Error optimizing trajectory:', error);
      alert(localization.t(language, 'Failed to trigger trajectory optimization. See console for details.') || 'Failed to trigger trajectory optimization. See console for details.');
    });
  },

  clearOptimizedRoute: function() {
    if (this._optimizedPolyline) {
      this._map.removeLayer(this._optimizedPolyline);
      this._optimizedPolyline = null;
    }
  },

  setRouteCoordinates: function(coordinates) {
    this._routeCoordinates = coordinates;
    if (coordinates && coordinates.length > 0) {
      this._enable();
    } else {
      this._disable();
    }
  },

  _enable: function() {
    L.DomUtil.removeClass(this._button, 'leaflet-disabled');
  },

  _disable: function() {
    L.DomUtil.addClass(this._button, 'leaflet-disabled');
  }
});

module.exports = function(options) {
  return new OptimizeControl(options);
};

