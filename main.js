/**
 * @fileoverview Builds a "big board" overview of the top pages of a
 * given site, using the chartbeat.com API
 * (http://api.chartbeat.com).
 *
 * The main widget is Toppages, which is holds all the core logic and
 * manages the entire screen. The individual rows are handled bye Page.
 */

goog.provide('demo.widget.Toppages');

// Unfortunately required to make the compiler not warn in closure
// library files
goog.require('goog.debug.ErrorHandler');
goog.require('goog.events.EventHandler');
goog.require('goog.events.EventTarget');

// Our requires
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.events.Event');
goog.require('goog.fx.Animation');
goog.require('goog.fx.dom');
goog.require('goog.net.Jsonp');
goog.require('goog.array');
goog.require('goog.string');
goog.require('goog.style');
goog.require('goog.Uri');

/*
 * Modify encodeURIComponent so that it does not encode ',',
 * by replacing "%2C" (url encoding of ',') with "," after encoding. It is
 * very hacky, but is needed to get embedly API to work which only accepts
 * ',' between the distinct values for the 'urls' parameter in its rest API.
 */
window.oldEncodeURIComponent = window.encodeURIComponent;
window.encodeURIComponent = function(str) {
  return window.oldEncodeURIComponent(str).replace(/%2C/g,',');
}

demo.ConfigManager = function() {
  var EMBEDLY_KEY = '';
  var API_KEY = '';
  var HOST = 'ted.com';
  var ENABLE_CHAT = false;
  var NUM_COLS = 5;
  var NUM_PAGES = 30;

  this.config_ = {
    'embedlyKey': EMBEDLY_KEY,
    'apiKey': API_KEY,
    'host': HOST,
    'enableChat': ENABLE_CHAT,
    'numCols': NUM_COLS,
    'numPages': NUM_PAGES,
  }
}

demo.ConfigManager.prototype.getConfig = function(key) {
  var value = this.getUrlParams_()[key] || this.config_[key];
  return value;
};

demo.ConfigManager.prototype.getUrlParams_ = function() {
  var vars = [], hash;

  var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
  for(var i = 0; i < hashes.length; i++)
  {
    hash = hashes[i].split('=');
    vars.push(hash[0]);
    vars[hash[0]] = hash[1];
  }
  return vars;
}

var configManger = new demo.ConfigManager();

//////////////////////////////////////////////////////////////////////
/**
 * Widget that shows an individual page (i.e. row).
 *
 * @param {string} host Host/domain name for the page.
 * @param {string} path Page path.
 * @param {string} title Page title.
 * @param {number} count Visitor count for the page.
 *
 * @constructor
 */
demo.widget.Page = function(host, path, title, count, img_url, videoHtml) {
  /**
   * Duration of all animations (ms)
   * @type {number}
   * @const
   * @private
   */
  this.animDuration_ = 1000;
  this.videoHtml = videoHtml;

  /**
   * Current number of visitors shown.
   * @type {number}
   * @private
   */
  this.count_ = count;

  /**
   * Image showing the current trend of the page (up/down).
   * @type {Element}
   * @private
   */
  this.trendElement_ = goog.dom.createDom("img",
                                          {"src": "images/blank.png",
                                           "class": "trend"});
  var image = goog.dom.createDom("img",
                                   {"src": img_url,
                                   });

  /**
   * Element showing the number of visitors on the page.
   * @type {Element}
   * @private
   */
  this.visitorsElement_ = goog.dom.createDom("div",
                                             {"class": "visitors"},
                                             ["" + count]);

  this.videoElement_ = goog.dom.createDom("div",
      {"class": "videoHtml", 'style': 'display:none;'},
      [videoHtml]
      );

  this.titleElement_ = goog.dom.createDom("div",
      {"class": "title"},
      [title]);

  /**
   * The DOM for the widget
   * @type {Element}
   * @private
   */
  this.element_ = goog.dom.createDom("div",
                                     {"class": "page_new img_container",
                                      "jsaction": "pageclick",
                                      "count": count,
                                      "jsvalue": "http://" + host + path,
                                      "style": "display: none;"},
                                     [this.visitorsElement_, " ", this.trendElement_, " ",
                                      image, " ", this.titleElement_, " ", this.videoElement_]);
};

/**
 * Get the DOM element for the widget.
 *
 * @return {Element}
 */
demo.widget.Page.prototype.getElement = function() {
  return this.element_;
};

/**
 * Fade in the element.
 */
demo.widget.Page.prototype.fadeIn = function() {
  var anim = new goog.fx.dom.FadeInAndShow(this.element_, this.animDuration_);
  anim.play();
};

/**
 * Set the current number of visitors.
 *
 * @param {number} count New visitor count.
 */
demo.widget.Page.prototype.setVisitors = function(count) {
  if (count == this.count_) {
    return;
  }

  this.animateNumbers_(this.count_, count);
  this.trendElement_.src = count > this.count_ ? "images/up.png" : "images/down.png";
  this.count_ = count;
};

/**
 * Animate the visitor number.
 *
 * @param {number} from Number to start with.
 * @param {number} to Number to end with.
 *
 * @private
 */
demo.widget.Page.prototype.animateNumbers_ = function(from, to) {
  var anim = new goog.fx.Animation([from], [to], this.animDuration_);

  goog.events.listen(anim, goog.fx.Animation.EventType.ANIMATE,
                     goog.bind(function(step) {
                                 this.visitorsElement_.innerHTML = "" + Math.floor(step.coords[0]);
                               }, this));

  goog.events.listen(anim, goog.fx.Animation.EventType.END,
                     goog.bind(function() {
                                 this.visitorsElement_.innerHTML = "" + to;
                               }, this));
  this.visitorsElement_.setAttribute('newValue', to);
  anim.play();
};

/**
 * Fade out the widget, and dispose it.
 */
demo.widget.Page.prototype.fadeOutAndRemove = function() {
  this.dispose_();
};

/**
 * Remove the element from the DOM, and clean up.
 *
 * @private
 */
demo.widget.Page.prototype.dispose_ = function() {
  goog.dom.removeNode(this.element_);
  this.element_ = null;
};


//////////////////////////////////////////////////////////////////////
/**
 * Main widget, that drives the entire display.
 *
 * @param {string|Element} element Element to show the widget in.
 * @param {string} host Hostname to show top pages for.
 * @param {string} apiKey API key to use.
 * @param {string=} regexp Regular expression of paths to ignore.
 *
 * @constructor
 */
demo.widget.Toppages = function(element) {
  /**
   * @type {Element}
   * @private
   */
  this.element_ = goog.dom.getElement(element);
  this.container_ = null;

  /**
   * @type {string}
   * @private
   */
  this.host_ = configManger.getConfig('host');

  /**
   * @type {string}
   * @private
   */
  this.apiKey_ = configManger.getConfig('apiKey');

  /**
   * @type {?RegExp}
   * @private
   */
  this.ignoreExpr_ = null;

  /**
   * Dictionary of currently shown pages
   * @type {Object}
   */
  this.pages_ = {};

  /**
   * Update interval for background data (ms)
   * @type {number}
   * @const
   * @private
   */
  this.updateInterval_ = 10000;

  /**
   * Number of pages to retrieve from backend API.
   * @type {number}
   * @const
   * @private
   */
  this.numPages_ = configManger.getConfig('numPages');

  this.data_ = null;
  this.embedlyData_ = [];
};

/**
 * Starts fetching of the backend data, and the main widget
 * functionality.
 */
demo.widget.Toppages.prototype.start = function() {
  // Set up general click handler

  // Set up backend /toppages call. The full API documentation can be
  // found here: http://chartbeat.pbworks.com/toppages
  var uri = new goog.Uri("http://api.chartbeat.com/toppages/");
  uri.setParameterValue("host", this.host_);
  uri.setParameterValue("apikey", this.apiKey_);
  uri.setParameterValue("limit", this.numPages_);

  /**
   * The server channel used to communicate with the backend server.
   * @type {goog.net.Jsonp}
   * @private
   */
  this.server_ = new goog.net.Jsonp(uri, "jsonp");
  // Start fetching data
  window['interval_'] = goog.global.setTimeout(goog.bind(this.update_, this), this.updateInterval_);
  this.update_();
};

/**
 * Update the backend data.
 *
 * @param {goog.events.Event=} event
 *
 * @private
 */
demo.widget.Toppages.prototype.update_ = function(event) {
  this.server_.send({}, goog.bind(this.onData_, this));
};

/**
 * Handles all clicks on the content
 *
 * @param {goog.events.Event} event Click event
 *
 * @private
 */
demo.widget.Toppages.prototype.onClick_ = function(event) {
  var action = this.getJsAction_(event);
  if (action.action == "pageclick") {
    goog.global.open(action.value);
  }
};

/**
 * Implement the JSAction pattern, described at http://bit.ly/9od5Zx
 *
 * @param {goog.events.Event} event
 * @return {Object}
 *
 * @private
 */
demo.widget.Toppages.prototype.getJsAction_ = function(event) {
  var targetAction = null;
  var targetValue = null;
  var t = event.target;
  while (t && !targetAction) {
    if (t.getAttribute) {
      targetAction = t.getAttribute('jsaction') || t['jsaction'];
      targetValue = t.getAttribute('jsvalue') || t['jsvalue'];
    }
    t = t.parentNode;
  }
  return { action: targetAction, value: targetValue };
};

demo.widget.Toppages.prototype.onData_ = function(data) {
  if (!data) {
    return;
  }
  this.data_ = data;
  var host = this.host_;
  var paths = goog.array.map(data, function(elem) { return host + elem['path']; });
  paths = goog.array.filter(paths, function(path, idx) { return path.indexOf('html') >= 0});
  this.embedlyData_ = [];
  this.paths_ = paths
  this.getEmbedlyData_();

}

demo.widget.Toppages.prototype.getEmbedlyData_ = function() {
  var embedlyUri = new goog.Uri("http://api.embed.ly/1/oembed");
  embedlyUri.setParameterValue("key", configManger.getConfig('embedlyKey'));

  var curPaths = this.paths_;
  if(curPaths.length > 20) {
    curPaths = this.paths_.splice(0, 20);
  } else {
    this.paths_ = [];
  }
  embedlyUri.setParameterValue("urls", curPaths.join(','));
  this.embedlyServer_ = new goog.net.Jsonp(embedlyUri);
  this.embedlyServer_.send({}, goog.bind(this.onEmbedlyData_, this));
}

/**
 * Called when new data is received from the backend.
 *
 * @param {Array.<Object>} data Data received from server
 *
 * @private
 */
demo.widget.Toppages.prototype.onEmbedlyData_ = function(data) {
  if (!data) {
    return;
  }
  this.embedlyData_ = goog.array.concat(this.embedlyData_, data);
  if (this.paths_.length > 0) {
    this.getEmbedlyData_();
    return;
  }
  data = this.embedlyData_;
  var j = 0;
  for (var i = 0; i < this.data_.length; ++i) {
    if (j == data.length) {
        break;
    }
    var page = this.data_[i];
    if (page['path'].indexOf('html') < 0) {
        continue;
    }
    data[j]['path'] = page['path'];
    data[j]['visitors'] = page['visitors'];
    j++;
  }

  // This is used to build up a new this.pages_ dictionary. All
  // objects used from this.pages_ will be moved from this.pages_ into
  // newpages. Thus, at the end of the for loop, this.pages_ will
  // contain all the unused objects -- which should be removed.
  var newpages = {};
  var firstTime = false;
  if(!window.isotope) {
    firstTime = true;
    window.isotope = $('#container').isotope({
      // options
      itemSelector : '.page_new',
      getSortData : {
        symbol : function( $elem ) {
          var newVal = parseInt($elem.find('.visitors')[0].getAttribute('newValue'));
          var val = parseInt($elem.find('.visitors').text());
          val = newVal || val;
          return val;
        }
      }
    });
    $('#container').isotope({ sortBy : 'symbol', sortAscending : false});
  }
  for (var i = 0; i < data.length; ++i) {
    var page = data[i];
    if (this.ignoreExpr_ && this.ignoreExpr_.test(page["path"])) {
      continue;
    }

    /**
     * @type {demo.widget.Page}
     */
    var el = this.pages_[page["path"]];
    if (!page["thumbnail_url"]) {
      continue;
    }
    if (!el) {
      el = new demo.widget.Page(this.host_, page["path"], page["title"], page["visitors"],  page["thumbnail_url"], page["html"]);
      $('#container').isotope('insert', $(el.getElement()));
      el.fadeIn();
    } else if(el) {
      var value = parseInt(Math.random()*500)
      // Page already shown
      delete this.pages_[page["path"]];
      el.setVisitors(page["visitors"]);
    }
    newpages[page["path"]] = el;
  }

  goog.object.forEach(this.pages_, function(element, index, obj) {
                      });

  goog.object.forEach(this.newpages, function(element, index, obj) {
                        element.fadeOutAndRemove();
                      });

  $('#container').isotope( 'updateSortData', $('.page_new'))
  $('#container').isotope({ sortBy : 'symbol', sortAscending : false});
  // New currently shown pages dict
  this.pages_ = newpages;
  if(firstTime) {
    setDivSize();
  }

  $(".page_new").colorbox({html:function(){
    var innerHtml = "<div class='outer_frame'>" +
      $.colorbox.element().find('.videoHtml').text();
    var chatRoom = $.colorbox.element().find('.title').text().split(' ').join('').replace(/[^a-zA-Z]+/g,'');
    if(chatRoom.length > 10) {
      chatRoom = chatRoom.substring(0,10);
    }
    if(configManger.getConfig('enableChat')) {
      innerHtml += "<div class='chat_container'><iframe class='chat_frame' scrolling='no' src='http://localhost:8001?chatRoom=" + chatRoom + "'></iframe></div></div>"
    } else {
      innerHtml += "</div>";
    }
    return innerHtml;
  }});
};

/**
 * Initializes the widget, and generally kicks off things on the page.
 *
 * @param {string|Element} element Element to show the widget in.
 * @param {string} host Hostname to show top pages for.
 * @param {string} apiKey API key to use.
 * @param {string=} regexp Regular expression of paths to ignore.
 */
function init(element) {
  var widget = new demo.widget.Toppages(element);
  widget.start();
  $(window).resize(function() { setDivSize() });
  window['widget'] = widget;
}

function setDivSize() {
  var height = _getDimension('height', 200, 300);
  var width = _getDimension('width', 300, 400);
  $('.img_container').css('width', width);
  $('.img_container').css('height', height);
  $('.title').css('width', width - parseInt($('.title').css('padding-right')));
  $('.title').css('top', height - parseInt($('.title').css('height')));
  $('#container').isotope('reLayout')
}

function _getDimension(dimension, min, max) {
  var numItemsArr = [6, 5, 4, 3, 2];
  var bodyDim = parseInt($(window)[dimension]())
  for (var i=0; i < numItemsArr.length; i++) {
    var numItems = numItemsArr[i];
    var suggestedDim = bodyDim / numItems - 13;
    if (suggestedDim > min && suggestedDim < max) {
      return suggestedDim;
    }
  }
}

function stop(element) {
  goog.global.clearInterval(window['interval_']);
}

// This is needed to make 'init' accessible from outside this script,
// when we are using the compiled version of it.
goog.exportSymbol('init', init);
goog.exportSymbol('stop', stop);
