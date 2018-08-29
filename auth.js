const Url = require('url')
const fs = require('fs')
const crypto = require('crypto-js')
const Base64 = crypto.enc.Base64
var logger = require('./log')

const MINUTE_WINDOW = 5

var appkeys = [
    {customer_name: 'Simon', appid: 'simon', key: 'simonrocks', custid:  'c_simon', ocn: 'A1234', currency: 'GBP', pricing_tier: '', region: 'EU', discount: 0},
    {customer_name: 'Test', appid: 'test',  key: 'test123test', custid: 'c_test',  ocn: 'A1235', currency: 'GBP', pricing_tier: '', region: 'EU', discount: 0}
]

var getPath = function(request) {
    var u = Url.parse(request.url)
    return u.path
}

var calcPreviousHour = function(d,m,y,h) {
    if(h == 0) {
	return calcPreviousDay(d, m, y) + '23'
    } else return formatDate(d,m,y,h-1)
}

var calcNextHour = function(d,m,y,h) {
    if(h == 23) {
	return calcNextDay(d,m,y) + '00'
    } else return formatDate(d,m,y,h+1)
}

var calcPreviousDay = function (d, m, y) {
    if(d==1) {
	var prevm = m -1
	if(prevm == 0) return formatDate(31,12,y-1)
	if([9,4,6,11].includes(prevm)) return formatDate(30,prevm,y)
	return formatDate(31,prevm,y)
    }
    return formatDate(d-1,m,y)
}

var calcNextDay = function(d, m, y) {
    if(m == 2) {
	if(y % 4 > 0 && d == 28) return formatDate(1,3,y)
	if(y % 4 == 0 && d == 29) return formatDate(1,3,y)
    }
    if(d == 30 && [4,6,9,11].includes(m)) return formatDate(1,m+1,y) 
    if(d == 31) {
	if(m==12) return formatDate(1,1,y+1)
	return formatDate(1, m+1, y)
    } 
    return formatDate(d+1, m, y)
}

var formatDate = function(day, month, yr, hr) {
    var m = '' + month
    var d = '' + day
    var h = '' + hr
    if(m.length < 2) m = '0' + m
    if(d.length < 2) d = '0' + d
    if(h.length < 2) h = '0' + h
    return(yr+m+d+h) 
}

var getDatestamps = function() {
    var now = new Date()
    var d = now.getUTCDate()
    var m = now.getUTCMonth() + 1
    var yr = now.getUTCFullYear()
    var hr = now.getUTCHours()

    var retval = [formatDate(d,m,yr, hr)]

    var min = now.getMinutes()
    if(min >= 60 - MINUTE_WINDOW) retval.push(calcNextHour(d ,m, yr, hr))
    if(min <= MINUTE_WINDOW) 	retval.push(calcPreviousHour(d, m, yr, hr))

    return retval	
}

var computeStringSig = exports.calcHMAC = function(body, key) {
    if(typeof body == 'undefined' || body.length < 1) body =''
    logger.info('Encrypting: ' + body)
    var sig = crypto.HmacSHA256(body, key)
    var sigb64 = Base64.stringify(sig)
    logger.info('Sig: ' + sigb64)
    return sigb64
}

var checkSig = function(sig, request, body_sig, key) {
    logger.info('Validating '+sig)
    var ds = getDatestamps()
    var path = getPath(request)
    return ds.some(function(ds) {
	var mysig = computeStringSig(ds + path + body_sig, key)
	logger.info('Checking '+mysig)
	return sig == mysig
    })
}
    
    
var getAppid = function(request) {
	return request.headers['x-colt-app-id']	
}

var getSignature = function(request) {
	return request.headers['x-colt-app-sig']	
}

var getMatchForAppId = function(appid) {
    var match = appkeys.find((element) => {return element.appid == appid })
	return match || null
}

var signBody = exports.signBody = function(body, key) {
	if(typeof body === 'object') {
	    logger.debug('Body is an object')
	    logger.debug('As string: '+JSON.stringify(body))
	    return computeStringSig(JSON.stringify(body), key)
	} else {
	    logger.debug('Body is a string')
	    return computeStringSig(''+body, key)
    }
}

var validateRequest = exports.validateRequest = function(request, body) {
    return new Promise((resolve, reject) => {
        var appid = getAppid(request)
        var match = getMatchForAppId(appid)
        var sig = getSignature(request)
        if(!match) reject({status: 404, message: 'Unrecognised AppId'})
        if(!sig) reject({status: 402, message: 'Missing signature'})
        
        var key = match.key

        logger.debug('Got key and sig')

        var signed_body = signBody(body, key)

        if(!checkSig(sig, request, signed_body, key)) {
            logger.info('Signature ' + sig + ' does not match expectation')
            reject({status: 403, message: 'Bad signature'})
        } else {
            logger.info('Sig ok')
            resolve(match)
        }
    })
}

var initKeys = module.exports.initKeys = function () {
    if (fs.existsSync('./data/keys.js')) {
        logger.info('Loading keys')
        appkeys = require('../data/keys')
    } else {
        logger.info('Falling back on built-in keys')
    }
    appkeys.forEach(element => {
        console.log(element.appid)
    });
}
