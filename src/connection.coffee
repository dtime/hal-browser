class Connection
  call_func: null
  options: {}
  constructor: (@call_func, opts)->
    @options = opts

  request: (opts)->
    opts = _.extend opts
    opts.type = opts.method if opts.method?
    opts.type ?= 'GET'
    if(@options.oauth_token)
      opts = _.extend opts,
        headers:
          Authorization: "OAuth #{@options.oauth_token}"
    @call_func(opts)