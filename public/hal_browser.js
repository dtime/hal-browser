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

      if (window.location.hash === '' || window.location.hash === "#GET:") {
        if(HalRequest.defaults.endpoint != ''){
          window.location.hash = "GET:"+HalRequest.defaults.endpoint ;
        }
        else{
          window.location.hash = "GET:https://api.dtime.com";
        }
      }
      else{
        console.log(window.location.hash);
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
      // var node =$("<pre class='prettyprint'>"+JSON.stringify(this.toJSON(), null, 2)+"</pre>");
      // return node;
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
      this.locationBar = new HAL.Views.LocationBar({ el: $('#location-bar') });
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
        var ret = HalRequest.request({url: url, method: method}).done(function(resource){
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
      'click .links a.templated_link': 'showUriQueryDialog',
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
      prettyPrint();

      this.$el.find('.state .headers').hide();
      headers = this.$el.find('.state .headers');
      this.$el.find('.state .toggler').toggle(function(){
        headers.slideDown();
        $(this).text('hide');
      }, function(){
        headers.slideUp();
        $(this).text('headers');
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

    showUriQueryDialog: function(e) {
      e.preventDefault();
      var d = new HAL.Views.QueryUriDialog({
        href: $(e.target).attr('href'),
        vars: $(e.target).data('href-vars')
      }).render();

      d.$el.dialog({
        title: 'Query URI Template',
        width: 400
      });
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
      'click .go': 'followLink',
      'click .method-list a': 'updateMethod'
    },

    followLink: function(e) {
      e.preventDefault();
      window.location.hash = this.go.text() + ":" + this.address.val();
    },
    setLocation: function(url) {
      $(document).scrollTop(0);
      this.address.val(url);
    },
    updateMethod: function(e) {
      this.go.text($(e.currentTarget).text())
      e.preventDefault();
    },
    setMethod: function(method) {
      this.go.text(method)
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
        this.$('.panel').slideDown();
        this.$('h1').remove();
        this.$el.prepend($("<h1>docs for "+e.rel+"</h1>").show());
        this.$('.toggler').text('hide');
      }
      this.$('.panel').html('<iframe src=' + e.url + '></iframe>').slideDown();
      $('body').scrollTop(0);
    },

    showRawResource: function(e) {
      this.$('.panel').slideUp();
      this.$el.delay(300).removeClass('active');
      this.$('h1').remove();
      this.$('.toggler').text('inspect');
      this.$('.panel').html('<pre>' + JSON.stringify(e.resource, null, 2) + '</pre>');
    },
    toggle: function(e){
      if(this.$('.panel').is(':visible')){
        this.$('.panel').slideUp();
        this.$('h1').remove();
        this.$('.toggler').text('show');
        this.$el.removeClass('active');
      }
      else{
        this.$el.prepend($("<h1>inspector</h1>").show());
        this.$('.toggler').text('hide');
        this.$el.addClass('active');
        this.$('.panel').slideDown();
      }
    }
  });
  HAL.Views.QueryUriDialog = Backbone.View.extend({
    initialize: function(opts) {
      this.href = opts.href;
      this.vars = opts.vars;
      if(this.vars === "undefined") this.vars = {};
      this.uriTemplate = uritemplate(this.href);
      _.bindAll(this, 'submitQuery');
      _.bindAll(this, 'renderPreview');
    },

    events: {
      'submit form': 'submitQuery',
      'keyup textarea': 'renderPreview',
      'keyup input': 'renderPreview',
      'change textarea': 'renderPreview',
      'change input': 'renderPreview'
    },

    submitQuery: function(e) {
      e.preventDefault();
      var input;
      input = this.pullData(e);
      if(!input){
        input = {};
      }
      this.$el.dialog('close');
      window.location.hash = this.uriTemplate.expand(input);
    },

    pullData: function(e){
      var data = {}, input = {};
      this.$('input').each(function(){
        if($(this).attr('name'))
          data[$(this).attr('name')] = $(this).val();
      });

      try {
        if(this.$('textarea').length > 0){
          input = JSON.parse(this.$('textarea').val());
          data = _.extend(data, input);
        }
      } catch (err) {
        return false;
      }
      return data;
    },

    renderPreview: function(e) {
      var input, result, data;
      data = this.pullData(e);
      if(data){
        result = this.uriTemplate.expand(data);
      }else {
        result = 'Invalid json input';
      }
      this.$('.preview').html(result);
    },

    render: function() {
      this.$el.html(this.template({ href: this.href , vars: this.vars}));
      this.$('textarea').trigger('keyup');
      return this;
    },

    template: _.template($('#query-uri-template').html())
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
  HAL.templated = function(link) {
    var urlRegex = /(http|https):\/\/.*{.+}.*/;
    var str = link.href;
    if(!str) return false;
    return str.match(urlRegex);
  };
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
