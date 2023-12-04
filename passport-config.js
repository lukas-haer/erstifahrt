const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const Teamer = require('./schemas/Teamer')

function initialize (passport, getUserByName, getUserById){
    const authenticateUser = async (name, password, done) => {
        const teamer = await getUserByName(name)
        if (teamer == null ){
            return done(null, false, {message: 'Falscher Username'})
        }

        try {
            if (await bcrypt.compare(password, teamer.password)) {
                return done(null, teamer)
            } else {
                return done(null, false, {message: 'Falsches Passwort'})
            }
        } catch (e) {
            return done(e)
        }
        
    }

    passport.use(new LocalStrategy({usernameField: 'mail'}, authenticateUser))
    passport.serializeUser((teamer, done) => done(null,teamer.id))
    passport.deserializeUser(async (id, done) => {
        try {
            const teamer = await Teamer.findById(id);
            done(null, teamer);
        } catch (error) {
            done(error, null);
        }
    });
}

module.exports = initialize