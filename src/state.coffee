class State
  constructor: (@state, @_connection)->
    _.extend(this, @state)

  request: (url, opts = {})->
    @connection.request opts

  transition: (method, rel, opts = {})->
    @connection.request
      method: method

