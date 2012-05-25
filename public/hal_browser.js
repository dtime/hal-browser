(function() {
  var HAL = {
    Models: {},
    Views: {}
  };


  HAL.Router = Backbone.Router.extend({
    initialize: function(opts) {
      var self = this;
      opts = opts || {};

      $.ajaxSetup({ crossDomain: true, headers: { 'Accept': 'application/hal+json, application/json, */*; q=0.01' } });

      this.browser = new HAL.Views.Browser({ el: $('#browser') });
      this.inspectorView = new HAL.Views.Inspector({ el: $('#inspector') });

      this.browser.bind('show-docs', function(e) {
        self.inspectorView.showDocs(e);
      });
      this.browser.bind('render-resource', function(e) {
        self.inspectorView.showRawResource(e);
      });

      if (window.location.hash === '') {
        var entry = opts.entryPoint || Dtime.defaults.endpoint;
        window.location.hash = "GET:"+entry;
      }
    },

    routes: {
      '*url': 'resourceRoute'
    },

    resourceRoute: function(url) {
      var method = null, splits = null;
      url = location.hash.slice(1); // router removes preceding slash so get it manually
      splits = url.split(':');
      method = splits.shift();
      if(method == "http" || method == "https"){
        splits.unshift(method);
        method = "GET";
      }
      url = splits.join(':');
      this.browser.get(url, method);
    }
  });

  HAL.Models.Resource = Backbone.Model.extend({
    initialize: function(representation, jqxhr) {
      if(representation._links !== undefined) {
        this.links = representation._links;
      }
      if(representation._embedded !== undefined) {
        this.embeddedResources = this.buildEmbeddedResources(representation._embedded, jqxhr);
      }
      if(representation._template !== undefined) {
        this.template = this._template;
      }
      this.request_object = jqxhr;
      this.set(representation);
      this.unset('_embedded', { silent: true });
      this.unset('_template', { silent: true });
      this.unset('_links', { silent: true });
    },
    headers: function(){
      return this.request_object.getAllResponseHeaders()
    },
    toTable: function(){
      return prettyPrint(this.toJSON(), {maxDepth: 5, maxArray: 5})
    },
    toHtmlTable: function(){
      return $(prettyPrint(this.toJSON(), {maxDepth: 5, maxArray: 5})).html();
    },


    buildEmbeddedResources: function(embeddedResources, jqxhr) {
      var result = {};
      _.each(embeddedResources, function(obj, rel) {
        if($.isArray(obj)) {
          var arr = [];
          _.each(obj, function(resource, i) {
            var newResource = new HAL.Models.Resource(resource, jqxhr);
            newResource.identifier = rel + '[' + i + ']';
            arr.push(newResource);
          });
          result[rel] = arr;
        } else {
          var newResource = new HAL.Models.Resource(obj, jqxhr);
          newResource.identifier = rel;
          result[rel] = newResource;
        }
      });
      return result;
    }
  });


  HAL.Views.Browser = Backbone.View.extend({

    initialize: function() {
      var self = this;
      this.locationBar = new HAL.Views.LocationBar({ el: this.$('#location-bar') });
      this.locationBar.browser = self;
      this.resourceView = new HAL.Views.Resource({ el: this.$('#current-resource') });
      this.resourceView.bind('show-docs', function(e) { self.trigger('show-docs', e); });
    },

    get: function(url, method) {
      var self = this;
      this.locationBar.setLocation(url);
      this.locationBar.setMethod(method);
      if(HAL.isUrlTemplate(url)){

      }
      else{
        var ret = Dtime.request({url: url, method: method}).done(function(resource){
          self.resourceView.render(new HAL.Models.Resource(resource.state, resource.xhr));
          self.trigger('render-resource', { resource: resource.state });
        }).fail(function(jqxhr) {
          self.resourceView.showFailedRequest(jqxhr);
          self.trigger('render-resource', { resource: null });
        });
      }
    }
  });

  HAL.Views.Resource = Backbone.View.extend({
    initialize: function(opts) {
      _.bindAll(this, 'followLink');
      _.bindAll(this, 'showDocs');
    },

    events: {
      'click .links a.link': 'followLink',
      'click .links a.dox': 'showDocs'
    },

    render: function(resource) {
      this.$el.html(this.template({
        links: resource.links,
        top_state: resource.links,
        headers: resource.headers()
      }));
      this.resource = resource.toJSON();
      this.$el.find('.state .response').append(resource.toTable());
      this.$el.find('.state .headers').hide();
      headers = this.$el.find('.state .headers');
      this.$el.find('.state .toggler').toggle(function(){
        headers.slideDown();
        $(this).text('[hide]');
      }, function(){
        headers.slideUp();
        $(this).text('[headers]');
      });
      var $embres = this.$('.embedded-resources');
      $embres.empty().replaceWith(this.renderEmbeddedResources(resource.embeddedResources, resource));
      this.$('.embedded-resources').accordion();
      return this;
    },

    showFailedRequest: function(jqxhr) {
      this.$el.html(this.failedRequestTemplate({ jqxhr: jqxhr }));
    },

    followLink: function(e) {
      e.preventDefault();
      window.location.hash = "GET:"+$(e.target).attr('href');
    },

    showDocs: function(e) {
      e.preventDefault();
      this.trigger('show-docs', { url: $(e.target).attr('href'), rel: $(e.target).data('rel') });
    },

    renderEmbeddedResources: function(embeddedResources, top_state) {
      var self = this;
      var nested = true;
      var result = null;
      if(!result){
        nested = false;
        result = $('<div class="embedded-resources">');
      }
      _.each(embeddedResources, function(obj) {
        if ($.isArray(obj)) {
          _.each(obj, function(resource) {
            var new_template = self.embeddedResourceTemplate({
              state: resource.toHtmlTable(),
              top_state: top_state.links,
              links: resource.links,
              name: resource.identifier
            });
            var $new_template = $(new_template);
            $(result).append($new_template);
            $new_template.find('.nested-resources').replaceWith(self.renderEmbeddedResources(resource.embeddedResources, resource));
            $new_template.find('.embedded-resources').attr('class', 'nested-resources');
            $new_template.find('.nested-resources>h3>a').attr('href', 'javascript:false');
          });
        } else {
          var new_template = self.embeddedResourceTemplate({
            state: obj.toHtmlTable(),
            top_state: top_state.links,
            links: obj.links,
            name: obj.identifier
          });
          var $new_template = $(new_template);
          $(result).append($new_template);
          $new_template.find('.nested-resources').replaceWith(self.renderEmbeddedResources(obj.embeddedResources, obj));
          $new_template.find('.embedded-resources').attr('class', 'nested-resources');
          $new_template.find('.nested-resources a').attr('href', 'javascript:false');
        }
        console.log($(result));
      });
      return result;
    },

    template: _.template($('#resource-template').html()),

    failedRequestTemplate: _.template($('#failed-request-template').html()),

    embeddedResourceTemplate: _.template($('#embedded-resource-template').html())
  });

  HAL.Views.LocationBar = Backbone.View.extend({
    events: {
      'click .go': 'followLink'
    },

    followLink: function(e) {
      e.preventDefault();
      window.location.hash = this.method.val() + ":" + this.address.val();
    },
    setLocation: function(url) {
      $(document).scrollTop(0);
      this.address.val(url);
    },
    setMethod: function(method) {
      this.method.val(method)
    },

    address: $('.address'),
    go: $('.go'),
    method: $('.method'),
  });

  HAL.Views.Inspector = Backbone.View.extend({
    events: {
      'click .toggler': 'toggle'
    },
    showDocs: function(e) {
      if(this.$('.panel').not(':visible')){
        this.$el.addClass('active');
        this.$('.panel').delay(300).fadeIn();
        this.$('h1').remove();
        this.$el.prepend($("<h1>docs for "+e.rel+"</h1>").hide().delay(300).fadeIn());
        this.$('.toggler').text('[hide]');
      }
      this.$('.panel').html('<iframe src=' + e.url + '></iframe>');
    },

    showRawResource: function(e) {
      this.$('.panel').fadeOut();
      this.$el.delay(300).removeClass('active');
      this.$('h1').remove();
      this.$('.toggler').text('[inspect]');
      this.$('.panel').html('<pre>' + JSON.stringify(e.resource, null, 2) + '</pre>');
    },
    toggle: function(e){
      if(this.$('.panel').is(':visible')){
        this.$('.panel').hide();
        this.$('h1').remove();
        this.$('.toggler').text('[show]');
        this.$el.removeClass('active');
      }
      else{
        this.$('.panel').delay(300).fadeIn();
        this.$el.prepend($("<h1>inspector</h1>").hide().delay(300).fadeIn());
        this.$('.toggler').text('[hide]');
        this.$el.addClass('active');
      }
    }
  });

  HAL.curie = function(str, state) {
    if(HAL.isUrl(str)){
      return str;
    }
    else{
      var url = HAL.find_href(state, 'curie', {relation: str});
      if(HAL.isUrl(url)){
        return url;
      }
      else{
        return false;
      }
    }

  },
  HAL.find_link = function(state_links, rel) {
    var link;
    for (link in state_links) {
        if (link == rel) {
            return state_links[rel];
        }
    }
    return false;
  },
  HAL.find_href = function (state, rel, tmpl) {
    var link, template;
    link = HAL.find_link(state, rel);
    if (link && link["href"]) {
      template = uritemplate(link["href"]);
      return template.expand(tmpl);
    } else {
      return (link ? link.href : link);
    }
  },
  HAL.isUrlTemplate = function(str) {
    var urlRegex = /(http|https):\/\/.*{.+}.*/;
    if(!str) return false;
    return str.match(urlRegex);
  };
  HAL.isUrl = function(str) {
    var urlRegex = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    if(!str) return false;
    return str.match(urlRegex);
  };

  HAL.truncateIfUrl = function(str) {
    var replaceRegex = /(http|https):\/\/([^\/]*)\//;
    return str.replace(replaceRegex, '.../');
  };

  // make HAL object global
  window.HAL = HAL;
})();
