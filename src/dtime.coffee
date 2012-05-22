window.Dtime =
  defaults:
    client_id: '4ee43e9abce748bebf000002'
    client_secret: 'goodpassword'
    endpoint: "http://sshinto.me:9292/"

  request: (opts = {})->
    new_opts = _.defaults(opts, @defaults)
    connection = this.new_connection(new_opts)
    state = connection.request(opts).pipe (s)->
      new State(s, connection)
    state

  new_connection: (opts = {})->
    throw "No client_id set" unless opts.client_id
    throw "No client_secret set" unless opts.client_secret
    opts.request ?= $.ajax
    new Connection(opts.request, opts)


