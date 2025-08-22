'use strict';

var L = require('leaflet');
var options = require('./lrm_options');
var localization = require('./localization');

function createRoutingControl(plan, leafletOptions, language, mergedOptions, ItineraryBuilder, containerClassName) {
  var controlOptions = {
    plan: plan,
    routeWhileDragging: options.lrm.routeWhileDragging,
    lineOptions: options.lrm.lineOptions,
    altLineOptions: options.lrm.altLineOptions,
    summaryTemplate: options.lrm.summaryTemplate,
    containerClassName: (options.lrm.containerClassName || '') + ' ' + containerClassName,
    alternativeClassName: options.lrm.alternativeClassName,
    stepClassName: options.lrm.stepClassName,
    language: 'en', // we are injecting own translations via osrm-text-instructions
    showAlternatives: options.lrm.showAlternatives,
    units: mergedOptions.units,
    serviceUrl: leafletOptions.services[0].path,
    useHints: false,
    services: leafletOptions.services,
    useZoomParameter: options.lrm.useZoomParameter,
    routeDragInterval: options.lrm.routeDragInterval,
    collapsible: options.lrm.collapsible,
    itineraryBuilder: new ItineraryBuilder(),
  };

  // translate profile names
  for (var profile = 0, len = controlOptions.services.length; profile < len; profile++)
  {
    controlOptions.services[profile].label = localization.t(language, controlOptions.services[profile].label) || controlOptions.services[profile].label;
  }

  var router = (new L.Routing.OSRMv1(controlOptions));
  router._convertRouteOriginal = router._convertRoute;
  router._convertRoute = function(responseRoute) {
    // console.log('Raw OSRM Route Object:', responseRoute);
    // monkey-patch L.Routing.OSRMv1 until it's easier to overwrite with a hook
    var resp = this._convertRouteOriginal(responseRoute);

    if (resp.instructions && resp.instructions.length) {
      var i = 0;
      responseRoute.legs.forEach(function(leg) {
        leg.steps.forEach(function(step) {
          // abusing the text property to save the original osrm step
          // for later use in the itnerary builder
          resp.instructions[i].text = step;
          i++;
        });
      });
    }

    // console.log('Decoded Route Coordinates:', resp.coordinates);
    return resp;
  };

  var lrmControl = L.Routing.control(Object.assign(controlOptions, {
    router: router
  }));

    // For convenience, we allow some control options to be set on the plan
  if (plan.options.position) {
    lrmControl.setPosition(plan.options.position);
  }

  return lrmControl;
}

module.exports = createRoutingControl;