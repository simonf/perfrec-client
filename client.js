const commandLineArgs = require('command-line-args')
const util = require('util')
var Client = require('node-rest-client').Client
var client = new Client()

var usage = (msg) => {
  console.log(msg)
  process.exit()
}

var parseAndDispatch = () => {
  /* first - parse the main command */
  const mainDefinitions = [
    { name: 'command', defaultOption: true }
  ]
  const mainOptions = commandLineArgs(mainDefinitions, { stopAtFirstUnknown: true })
  const argv = mainOptions._unknown || []

  // console.log('mainOptions\n===========')
  // console.log(mainOptions)

  switch(mainOptions.command) {
    case 'status':  getStatus(argv)
                    break
    case 'sign':    postSign(argv)
                    break
    case 'post':    postRecommendation(argv)
                    break
    case 'get':     getRecommendation(argv)
                    break
    default:        usage()
  }
}

var validateOrDie = (options, name) => {
  if (!options[name]) usage('You must supply a ' + name)
  return options[name]
}

var sendSignedGet = (url, appid, sig) => {
  var args = {
    headers: { 
      'x-colt-app-id': appid,
      'x-colt-app-sig': sig
    }
  }
  return new Promise((resolve, reject) => {
    let req = client.get(url, args, (data, response) => {
      resolve(data)
      })
    req.on('error', (err) => {
      reject(err)
    })
  })
}

var sendSignedPost = (url, appid, sig, body) => {
  var args = {
    data: body,
    headers: { 
      'Content-Type': 'application/json',
      'x-colt-app-id': appid,
      'x-colt-app-sig': sig
    }
  }
  return new Promise((resolve, reject) => {
    let req = client.post(url, args, (data, response) => {
      resolve(data)
      })
    req.on('error', (err) => {
      reject(err)
    })
  })  
}

var sendUnsignedPost = (url, payload) => {
  var args = {
    data: payload,
    headers: { "Content-Type": "application/json" }
  }
  // console.log(args)
  return new Promise((resolve, reject) => {
    let req = client.post(url, args,  (data, response) => {
      // console.log('Got sig: '+util.inspect(data))
      resolve(data)
    })
    req.on('error', (err) => {
      console.log('Error getting sig')
      reject(err)
    })
  })
}

var postSign = (argv) => {
  console.log('signing')
  const getSignDefinitions = [
    {name: 'host_string', alias: 'h', type: String},
    {name: 'key', alias: 'k', type: String},
    {name: 'body', alias: 'b', type: String},
    {name: 'path', alias: 'p', type: String}
  ]
  const getSignOptions = commandLineArgs(getSignDefinitions,{ argv })
  var host = validateOrDie(getSignOptions, 'host_string')
  var payload = getSignOptions.body
  var key = validateOrDie(getSignOptions,'key')
  var path = validateOrDie(getSignOptions,'path')
  
  var newbody = {
    plaintext: payload,
    key: key,
    path: path
  }

  var sign_url = host + '/sign'

  sendUnsignedPost(sign_url, newbody).then((sig) => { console.log(sig)})
}

var getStatus = (argv) => {
  const getStatusDefinitions = [
    {name: 'app_id', alias: 'a', type: String},
    {name: 'host_string', alias: 'h', type: String},
    {name: 'key', alias: 'k', type: String}
  ]
  const getStatusOptions = commandLineArgs(getStatusDefinitions,{ argv })
  var appid = validateOrDie(getStatusOptions, 'app_id')
  var host = validateOrDie(getStatusOptions, 'host_string')
  var key = validateOrDie(getStatusOptions,'key')
  
  var get_url = host + '/status'

  var body = {
    plaintext: '',
    path: '/status',
    key: key
  }

  sendUnsignedPost(host+'/sign', body).then((data) => {
    return sendSignedGet(get_url, appid, data.signature)
  }).then((response) => {
    console.log(response)
  }).catch((err) => {
    console.log('-------')
    console.log(err)
  })

}

var getRecommendation = (argv) => {
  const getRecDefinitions = [
    {name: 'app_id', alias: 'a', type: String},
    {name: 'host_string', alias: 'h', type: String},
    {name: 'key', alias: 'k', type: String},
    {name: 'recommendation_id', alias: 'r', type: Number}
  ]
  const getRecOptions = commandLineArgs(getRecDefinitions,{ argv })
  var appid = validateOrDie(getRecOptions, 'app_id')
  var host = validateOrDie(getRecOptions, 'host_string')
  var recid = validateOrDie(getRecOptions, 'recommendation_id')
  var key = validateOrDie(getRecOptions,'key')
  
  var get_url = host + '/recommendation/'+recid

  var body = {
    plaintext: '',
    path: '/recommendation/'+recid,
    key: key
  }

  sendUnsignedPost(host+'/sign', body).then((data) => {
    return sendSignedGet(get_url, appid, data.signature)
  }).then((response) => {
    console.log(response)
  }).catch((err) => {
    console.log('-------')
    console.log(err)
  })
}

var postRecommendation = (argv) => {
  const postRecDefinitions = [
    {name: 'app_id', alias: 'a', type: String},
    {name: 'host_string', alias: 'h', type: String},
    {name: 'key', alias: 'k', type: String},
    {name: 'service_id', alias: 's', type: String},
    {name: 'bw_change', alias: 'w', type: Number},
  ]
  const postRecOptions = commandLineArgs(postRecDefinitions,{ argv })
  var appid = validateOrDie(postRecOptions, 'app_id')
  var host = validateOrDie(postRecOptions, 'host_string')
  var key = validateOrDie(postRecOptions,'key')
  var svcid = validateOrDie(postRecOptions, 'service_id')
  var bwc = parseInt(validateOrDie(postRecOptions, 'bw_change'))
  var change_dir = bwc > 0 ? 'INCREASE_BANDWIDTH' : 'DECREASE_BANDWIDTH'
  
  var post_url = host + '/recommendation'

  var body = {
    plaintext: {
      service_id: svcid,
      bandwidth_change: bwc,
      action: change_dir
    },
    path: '/recommendation',
    key: key
  }

  sendUnsignedPost(host+'/sign', body).then((data) => {
    return sendSignedPost(post_url, appid, data.signature, body.plaintext)
  }).then((response) => {
    console.log(response)
  }).catch((err) => {
    console.log('-------')
    console.log(err)
  })
}


parseAndDispatch()

