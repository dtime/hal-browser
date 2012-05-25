require 'sinatra'
require 'slim'
require 'httparty'
require 'addressable/template'
require 'redcarpet'
require 'sinatra/partial'
require File.expand_path(File.dirname(__FILE__) + '/config')

set :partial_template_engine, :slim
enable :partial_underscores
enable :sessions

get '/' do
  slim :index
end

get '/explorer' do
  @api_token = session[:current_api_token]
  @api_root = session[:current_root]
  slim :explorer
end



get '/logout' do
  session[:current_api_token] = nil
  session[:current_root] = nil
  redirect '/'
end


# Used to find rels
def dtime_href_for(my_env, rel)
  Addressable::Template.new(settings.api_links[my_env][rel]['href'])
end

# Redirect to OAuth page
get '/login/:my_env' do
  my_env = (params[:my_env] || :dev).to_sym
  session[:current_root] = settings.api_root[my_env]
  redirect dtime_href_for(my_env, 'dtime:developers:oauth:authorize').expand({
    client_id: settings.api_oauth_client[my_env][:client_id],
    redirect_uri: url("/oauth/callback?my_env=#{my_env}")
  }).to_str, 303
end

# Get back OAuth token, redirect to explorer
get '/oauth/callback' do
  my_env = (params[:my_env] || :dev).to_sym
  if params[:error]
    token = HTTParty.post(
      dtime_href_for(my_env, 'dtime:developers:oauth:token').expand({
        code: params[:code],
        client_id: settings.api_oauth_client[my_env][:client_id],
        client_secret: settings.api_oauth_client[my_env][:client_secret],
      })
    )
    session[:current_api_token] = token["token"]
    redirect '/'
  else
    redirect '/explorer'
  end
end

