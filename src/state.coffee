class State
  constructor: (obj, @_connection)->
    _.extend(this, obj)

  request: (url, opts = {})->
    @connection.request opts

  transition: (method, rel, opts = {})->
    @connection.request
      method: method

