'use strict';

var L = require('leaflet');
var LRM = require('leaflet-routing-machine');
var makeIcon = require('./helper').makeIcon;
var ReversablePlan = require('./plan');

exports.addSecondVehicleRoute = function(L, plan, map, leafletOptions, localization, language) {
    // add onClick event
    map.on('click', function (e){
      addSecondWaypoint(e.latlng);
    });
    function addSecondWaypoint(waypoint) {
      var secondLength = secondLrmControl.getWaypoints().filter(function(pnt) {
        return pnt.latLng;
      });
      secondLength = secondLength.length;
      if (!secondLength) {
        secondPlan.spliceWaypoints(0, 1, waypoint);
      } else {
        if (secondLength === 1) secondLength = secondLength + 1;
        secondPlan.spliceWaypoints(secondLength - 1, 1, waypoint);
      }
    }

    // Custom control to trigger the trajectory optimizer
    var secondPlan = new ReversablePlan([], {
        geocoder: L.Control.Geocoder.nominatim(),
        routeWhileDragging: true,
        createMarker: function(i, wp, n) {
          var options = {
            draggable: this.draggableWaypoints,
            icon: makeIcon(i, n)
          };
          var marker = L.marker(wp.latLng, options);
          marker.on('click', function() {
            secondPlan.spliceWaypoints(i, 1);
          });
          return marker;
        },
        addWaypoints: true,
        waypointMode: 'snap',
        position: 'topleft',
        reverseWaypoints: true,
      });

      // add marker labels
      var controlOptions = {
        plan: secondPlan,
        routeWhileDragging: leafletOptions.lrm.routeWhileDragging,
        lineOptions: leafletOptions.lrm.lineOptions,
        altLineOptions: leafletOptions.lrm.altLineOptions,
        summaryTemplate: leafletOptions.lrm.summaryTemplate,
        containerClassName: leafletOptions.lrm.containerClassName + " second-vehicle",
        alternativeClassName: leafletOptions.lrm.alternativeClassName,
        stepClassName: leafletOptions.lrm.stepClassName,
        language: 'en', // we are injecting own translations via osrm-text-instructions
        showAlternatives: leafletOptions.lrm.showAlternatives,
        units: leafletOptions.defaultState.units,
        serviceUrl: leafletOptions.services[0].path,
        useHints: false,
        services: leafletOptions.services,
        routeDragInterval: leafletOptions.lrm.routeDragInterval,
        collapsible: leafletOptions.lrm.collapsible,
      };
      var secondRouter = (new L.Routing.OSRMv1(controlOptions));

      var secondLrmControl = L.Routing.control(Object.assign(controlOptions, {
        router: secondRouter
      })).addTo(map);

      return secondLrmControl;
}