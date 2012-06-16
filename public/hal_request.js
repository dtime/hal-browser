// Generated by CoffeeScript 1.3.1
(function() {
  var Connection, State;

  Connection = (function() {

    Connection.name = 'Connection';

    Connection.prototype.call_func = null;

    Connection.prototype.options = {};

    function Connection(call_func, opts) {
      this.call_func = call_func;
      this.options = opts;
    }

    Connection.prototype.request = function(opts) {
      opts = _.extend(opts);
      if (opts.method != null) {
        opts.type = opts.method;
      }
      if (opts.type == null) {
        opts.type = 'GET';
      }
      if (this.options.oauth_token) {
        opts = _.extend(opts, {
          headers: {
            Authorization: "OAuth " + this.options.oauth_token
          }
        });
      }
      return this.call_func(opts);
    };

    return Connection;

  })();

  window.HalRequest = {
    defaults: {
      client_id: '4ee43e9abce748bebf000002',
      client_secret: 'goodpassword',
      endpoint: "http://sshinto.me:9292/"
    },
    request: function(opts) {
      var connection, new_opts, state;
      if (opts == null) {
        opts = {};
      }
      new_opts = _.defaults(opts, this.defaults);
      connection = this.new_connection(new_opts);
      state = connection.request(opts).pipe(function(s, status, xhr) {
        return new State(s, connection, xhr);
      });
      return state;
    },
    new_connection: function(opts) {
      if (opts == null) {
        opts = {};
      }
      if (!opts.client_id) {
        throw "No client_id set";
      }
      if (!opts.client_secret) {
        throw "No client_secret set";
      }
      if (opts.request == null) {
        opts.request = $.ajax;
      }
      return new Connection(opts.request, opts);
    }
  };

  State = (function() {

    State.name = 'State';

    function State(state, _connection, xhr) {
      this.state = state;
      this._connection = _connection;
      this.xhr = xhr;
      _.extend(this, this.state);
    }

    State.prototype.request = function(url, opts) {
      if (opts == null) {
        opts = {};
      }
      return this.connection.request(opts);
    };

    State.prototype.transition = function(method, rel, opts) {
      if (opts == null) {
        opts = {};
      }
      return this.connection.request({
        method: method
      });
    };

    return State;

  })();

}).call(this);