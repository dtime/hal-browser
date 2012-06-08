configure do
  set :api_root,
    dev: "http://sshinto.me:9292/",
    stag: "http://dev-api.dtime.com/"

  set :api_links,
    dev: HTTParty.get(settings.api_root[ :dev ])['_links'],
    stag: HTTParty.get(settings.api_root[ :stag ])['_links']

  set :api_oauth_client,
    dev: {
      client_id: '4fa0abaa1a0f31656200004c',
      client_secret: '8d44b51d8860ea5a8ec9e8ca87509aea131fc5d85709f11f004995ea1c091b42'
    },
    stag: {
      client_id: '4fa0abaa1a0f31656200004c',
      client_secret: '8d44b51d8860ea5a8ec9e8ca87509aea131fc5d85709f11f004995ea1c091b42'
    }

end
