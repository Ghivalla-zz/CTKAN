const jwt = require('jsonwebtoken');
const redis = require('redis');

const redisClient = redis.createClient(process.env.REDIS_URI);

const handleSignin = (req, db, bcrypt) => {
    const { password, email } = req.body
    if(!password || !email) {
        return  Promise.reject('incorrect form submission')
    }
    return db.select('email', 'hash').from('login').where('email', '=', email)
    .then(data => {
        const isValid = bcrypt.compareSync(password, data[0].hash);
        if(isValid){
            return db.select('*').from('users').where('email', '=', email)
            .then(user => user[0])
            .catch(err => Promise.reject('unable to get users'))
        } else {
            Promise.reject('unable to get users')
        }
    })
    .catch(() => Promise.reject('unable to get users'));
};

const getAuthTokenId = (req, res) => {
    const {authorization} = req.headers;
    return redisClient.get(authorization, (err,reply)=>{
        if(err || !reply){
            return res.status(401).send('Unauthorized');
        }
        return res.json({id: reply})
    });
};

const signToken = (email) => {
    const jwtPaylod = { email };
    return jwt.sign(jwtPaylod, 'JWT_SECRET', {expiresIn: '2 days'});
}

const setToken = (key, value) => {
    return Promise.resolve(redisClient.set(key,value))
}

const createSessions = (user) => {
    const { email, id } = user;
    const token = signToken(email);
    return setToken(token, id)
        .then(()=>{
            return {
                success : 'true',
                userId : id,
                token
            }
        }).catch(console.log);
}

const signInAuthentication = (req, res, db, bcrypt) => {
    const { authorization } = req.headers;
    return authorization ?
        getAuthTokenId(req, res) :
        handleSignin(req, db, bcrypt)
        .then(data=>{
            return data.id && data.email ?
            createSessions(data) :
            Promise.reject(data)
        })
        .then(session =>{
            res.json(session)
        })
        .catch(err=>{
            res.status(400).json(err);
        })
};

module.exports = { signInAuthentication, redisClient };
