if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const express = require("express")
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const mongoose = require('mongoose')
const Teamer = require('./schemas/Teamer')
const ScoreChanges = require('./schemas/ScoreChanges')
const Strikes = require('./schemas/Strikes')
const Event = require('./schemas/Event')


mongoose.connect(process.env.MDB_CONNECTION)

const initializePassport = require('./passport-config')
const { render } = require('express/lib/response')
const e = require('method-override')
initializePassport(
    passport,
    name => Teamer.findOne({ name: name }),
    id => Teamer.findById(id).then()
)


app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))
app.use(express.static(__dirname + '/public'));

app.get('/', async (req, res) => {
 
    try {
        const scoreRavenclaw = await calcRavenPoints();
        const scoreHufflepuff = await calcHufflePoints();

        res.render('index.ejs', { scoreRavenclaw, scoreHufflepuff });
    } catch (error) {
        console.error(error);
        res.status(500).send("500: Mongoose Error"); // Handle error appropriately, redirect to an error page
    }
});

app.get('/teamer/', checkAuthenticated, async (req, res) => {
    let teamername = req.user.name
    const strikesData = await Strikes.find({});
    const strikers = strikesData.map(strikes => strikes.toObject());

    res.render('teamer.ejs', { name: req.user.name, strikers: strikers })
})

app.get('/login', (req, res) => {
    res.redirect('/teamer/login')
})

app.get('/teamer/login', checkNotAuthenticated, (req, res) => {
    res.render('login.ejs')
})

app.post('/teamer/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/teamer',
    failureRedirect: '/teamer/login',
    failureFlash: true
}))

app.get('/teamer/admin', checkAdmin, async (req, res) => {
    try {
        const teamerData = await Teamer.find({}); // Abfrage für Teamer-Daten aus der Datenbank
        const teamer = teamerData.map(teamer => teamer.toObject()); // Konvertieren Sie die Mongoose-Objekte in einfache JavaScript-Objekte
        res.render('admin.ejs', { error: "", teamer: teamer }); // Rendern Sie die EJS-Datei und übergeben Sie die Teamer-Daten als Variable
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Abrufen der Teamer-Daten' });
    }
})

app.post('/teamer/admin', checkAdmin, async (req, res) => {
    try {
        const hashedpswd = await bcrypt.hash(req.body.password, 10);

        const isTaken = await isUsernameTaken(req.body.name);

        let errorMsg = "Fehler"

        if (isTaken) {

            errorMsg = "Dieser Benutzername ist bereits vergeben"
        } else {
            let teamer = new Teamer({
                name: req.body.name,
                password: hashedpswd,
                role: req.body.role
            });

            await teamer.save(); // Verwenden Sie await hier, um auf die Speicherung in der Datenbank zu warten
            console.log(teamer);
            errorMsg = "Nutzer:in erstellt!"
        }
        const teamerData = await Teamer.find({});
        const teamer = teamerData.map(teamer => teamer.toObject());
        res.render('admin.ejs', { error: errorMsg, teamer: teamer });
    } catch (e) {
        console.error(e);
        res.status(500).redirect('/500');

    }

});

//Kontolöschung:
app.delete('/teamer/admin/delete-account', checkAdmin, async (req, res, next) => {
    const accountId = req.body.kontoZurLoeschung;


    try {
        // Hier wird das Dokument mit der angegebenen ID gelöscht
        await Teamer.deleteOne({ _id: accountId });
        const teamerData = await Teamer.find({});
        const teamer = teamerData.map(teamer => teamer.toObject());
        // Nach dem Löschen kannst du die aktualisierten Daten abrufen und rendern

        res.render('admin.ejs', { error: "", teamer: teamer });
    } catch (error) {
        const teamerData = await Teamer.find({});
        const teamer = teamerData.map(teamer => teamer.toObject());
        console.error("Fehler beim Löschen des Accounts:", error);
        res.render('admin.ejs', { error: "Fehler beim Löschen des Accounts", teamer: teamer });
    }
});

//Strikes löschen
app.delete('/teamer/admin/delete-strikes', checkAdmin, async (req,res,next) => {
    try {
        // Löscht alle Einträge in der Kollektion
        const loeschErgebnis = await Strikes.deleteMany({});
        
        console.log(`Es wurden ${loeschErgebnis.deletedCount} Einträge gelöscht.`);
    } catch (error) {
        console.error('Fehler beim Löschen der Einträge:', error);
    }
    res.redirect('/teamer');
});


//Punkte hinzufügen
app.post('/teamer/points/', checkAuthenticated, async (req, res) => {
    try {


        let points = new ScoreChanges({
            houseAffected: req.body.haus,
            pointsAwarded: req.body.pointsChanged,
            reasoning: req.body.reasoning,
            madeBy: req.user.name
        });

        await points.save(); // Verwenden Sie await hier, um auf die Speicherung in der Datenbank zu warten
        console.log(points);

        const script = `
        <script>
            alert('Punkte hinzugefügt');
            window.location.href = '/teamer'; // Leite den Benutzer zur Startseite weiter oder zur gewünschten Seite
        </script>
    `;
        ;
        res.status(200).send(script)

    } catch (e) {
        console.error(e);
        res.status(500).redirect(e);

    }


});

//Punkteübersicht
app.get('/teamer/points', checkAuthenticated, async (req, res) => {
    try {
        const ravenclawScores = await ScoreChanges.find({ houseAffected: "Ravenclaw" }).sort({ createdAt: 'asc' });
        const hufflepuffScores = await ScoreChanges.find({ houseAffected: "Hufflepuff" }).sort({ createdAt: 'asc' });

        res.render('points.ejs', { ravenclawScores, hufflepuffScores }); // Daten werden an die EJS-Datei übergeben
    } catch (error) {
        console.error(error);
        res.status(500).redirect('/500'); // Handle error appropriately, redirect to an error page
    }
});

//Punkte Löschen
app.get('/teamer/points/delete', checkAdmin, async (req, res, next) => {


    const scoreId = req.query.id;


    try {

        await ScoreChanges.deleteOne({ _id: scoreId });


        res.redirect('/teamer/points')
    } catch (error) {


        res.alert(error)
    }


});

async function calculateStrike(erstiName) {
    try {
        const ersti = await Strikes.findOne({ name: erstiName });

        if (ersti === null) {
            return 1;
        } else {
            return ++ersti.strikeNr
        }
    } catch (error) {
        console.error(error);
        return false; // Bei einem Fehler wird false zurückgegeben
    }
}

//Strikes hinzufügen
app.post('/teamer/strikes', checkAuthenticated, async (req, res, next) => {
    try {
        const ersti = await Strikes.findOne({ name: req.body.nameErsti });

        //Ersti hat noch keinen Strike
        if (ersti === null) {
            let Strike = new Strikes({
                name: req.body.nameErsti,
                reasoning: req.body.reasoningStrike,
                strikeNr: 1,
                madeBy: req.user.name,
            });
            
            await Strike.save();
            console.log(Strike)
        } else { //Ersti Strike wird um 1 erhöht
            ersti.strikeNr += 1;
            await ersti.save();
            console.log("UPDATED: "+ersti)
        }

        
        const strikesData = await Strikes.find({});
        const strikers = strikesData.map(strikes => strikes.toObject());
        res.render('teamer.ejs', { name: req.user.name, strikers: strikers });
    }
    catch (e) {
        console.error(e);
        res.status(500).redirect('/500');

    }
});

//LogOut
app.delete('/teamer/logout', checkAuthenticated, (req, res, next) => {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/teamer/login');
    });
});

app.get('/events', async (req, res) => {
    try {
        const eventsByDay = await getEventsbyDay();
        
        
        res.render('events.ejs',{eventsByDay})
      } catch (error) {
        
        console.error(error);
      }
})

app.get('/404', (req, res) => {
    res.render('404.ejs')
})

app.get('/500', (req, res) => {
    res.send("Error 500")
})

//404 Page

app.get('*', (req, res) => {
    res.status(404).redirect('/404')
})



function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }

    res.redirect('/')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/teamer/')
    }

    next()
}

function checkAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === "Admin") {
        return next()
    }


    res.redirect('/teamer')
}

async function isUsernameTaken(username) {
    try {
        const teamer = await Teamer.findOne({ name: username });

        return teamer !== null; // Wenn ein Benutzer mit dem angegebenen Benutzernamen gefunden wurde, gibt die Funktion true zurück, ansonsten false
    } catch (error) {
        console.error(error);
        return false; // Bei einem Fehler wird false zurückgegeben
    }
}


async function calcRavenPoints() {
    try {
        // Ravenclaw Punktestand
        const allRavenPoints = await ScoreChanges.find({ houseAffected: "Ravenclaw" });
        return allRavenPoints.reduce((total, change) => {
            return total + change.pointsAwarded;
        }, 0);
    } catch (error) {
        console.error(error);
        throw error; // Re-throw the error to handle it in the calling function
    }
}

async function calcHufflePoints() {
    try {
        // Hufflepuff Punktestand
        const allHufflePoints = await ScoreChanges.find({ houseAffected: "Hufflepuff" });
        return allHufflePoints.reduce((total, change) => {
            return total + change.pointsAwarded;
        }, 0);
    } catch (error) {
        console.error(error);
        throw error; // Re-throw the error to handle it in the calling function
    }
}

async function getEventsbyDay() {
    try {
      const pipeline = [
        {
          $addFields: {
            weekdayOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ["$day", "Montag"] }, then: 1 },
                  { case: { $eq: ["$day", "Dienstag"] }, then: 2 },
                  { case: { $eq: ["$day", "Mittwoch"] }, then: 3 },
                  { case: { $eq: ["$day", "Donnerstag"] }, then: 4 },
                  { case: { $eq: ["$day", "Freitag"] }, then: 5 },
                  { case: { $eq: ["$day", "Samstag"] }, then: 6 },
                  { case: { $eq: ["$day", "Sonntag"] }, then: 7 },
                ],
                default: 0
              }
            }
          }
        },
        {
          $sort: { weekdayOrder: 1, day: 1, wann: 1 } // Sortiere nach Wochentag, Tag und dann nach wann
        },
        {
          $group: {
            _id: "$day",
            events: { $push: "$$ROOT" }
          }
        },
        {
          $project: {
            _id: 0,
            day: "$_id",
            events: 1
          }
        }
      ];
  
      const result = await Event.aggregate(pipeline);
      return result;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

//Testing:


console.log("Server wird gestartet!")
app.listen(80)
