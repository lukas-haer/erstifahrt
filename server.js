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

//Startseite
app.get('/', async (req, res) => {
    
    try {
        const scoreRavenclaw = await calcRavenPoints();
        const scoreHufflepuff = await calcHufflePoints();
        const eventsByDay = await getEventsbyDay(req);


        res.render('index.ejs', { scoreRavenclaw, scoreHufflepuff, eventsByDay,  });
    } catch (error) {
        console.error(error);
        res.status(500).send("500: Mongoose Error"); // Handle error appropriately, redirect to an error page
    }
});

//Teamer-Bereich
app.get('/teamer/', checkAuthenticated, async (req, res) => {
    let teamername = req.user.name
    const strikesData = await Strikes.find({});
    const strikers = strikesData.map(strikes => strikes.toObject());

    res.render('teamer.ejs', { name: req.user.name, strikers: strikers })
})

//REDIRECTION auf /teamer/login
app.get('/login', (req, res) => {
    res.redirect('/teamer/login')
})

//Loginseite
app.get('/teamer/login', checkNotAuthenticated, (req, res) => {
    res.render('login.ejs')
})

//POST Login
app.post('/teamer/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/teamer',
    failureRedirect: '/teamer/login',
    failureFlash: true
}))

//Admin-Bereich
app.get('/teamer/admin', checkAdmin, async (req, res) => {
    try {
        const teamerData = await Teamer.find({}); // Abfrage für Teamer-Daten aus der Datenbank
        const teamer = teamerData.map(teamer => teamer.toObject()); // Konvertieren Sie die Mongoose-Objekte in einfache JavaScript-Objekte
        res.render('admin.ejs', { error: "", teamer: teamer }); // Rendern Sie die EJS-Datei und übergeben Sie die Teamer-Daten als Variable
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Abrufen der Teamer-Daten' });
    }
})

//POST Neues Konto
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


//Punkte ------------------------
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
//Ende Punkte --------------------


//Strikes ------------------------
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
            
        } else { //Ersti Strike wird um 1 erhöht
            ersti.strikeNr += 1;
            await ersti.save();
            console.log("UPDATED: " + ersti)
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

//Strikes löschen
app.delete('/teamer/admin/delete-strikes', checkAdmin, async (req, res, next) => {
    try {
        // Löscht alle Einträge in der Kollektion
        const loeschErgebnis = await Strikes.deleteMany({});

        console.log(`Es wurden ${loeschErgebnis.deletedCount} Einträge gelöscht.`);
    } catch (error) {
        console.error('Fehler beim Löschen der Einträge:', error);
    }
    res.redirect('/teamer');
});
//Ende Strikes -------------------

//Events -------------------------
//Event erstellen
app.get('/teamer/events', checkAuthenticated, (req,res) => {
    res.render('events.ejs')
});

//POST: Event erstellen
app.post('/teamer/events', checkAuthenticated, async (req, res) => {
    let dateAndTime = new Date(req.body.date + 'T' + req.body.time);
    const daysOfWeekNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const dayName = daysOfWeekNames[dateAndTime.getDay()]; 
    
    try {

        let event = new Event({
            description: req.body.description,
            descriptionHighlight: req.body.descriptionHighlight,
            date: dateAndTime,
            day: dayName,
            time: req.body.time,
            oldTime: req.body.oldTime,
            link: req.body.link,
            linkText: req.body.linkText,
            madeBy: req.body.name
        });

        await event.save(); // Verwenden Sie await hier, um auf die Speicherung in der Datenbank zu warten
        console.log(event);

        res.status(200).redirect('/');

    } catch (e) {
        console.error(e);
        res.status(500).redirect(e);

    }


});

//Events-Bearbeiten-SEITE
app.get('/teamer/events/edit', checkAuthenticated, async (req, res) => {
    try {
        const eventID = req.query.id;
        const event = await Event.findOne({ _id: eventID });

        res.render('events-update.ejs', { event });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).send('Internal Server Error');
    }
});

//POST: Events updaten 
app.post('/teamer/events/edit', checkAuthenticated, async (req, res) => {
    try {
        
        const eventID = req.body.EventID;
        let event = await Event.findOne({ _id: eventID });
        
        
        event.description = req.body.description,
        event.descriptionHighlight = req.body.descriptionHighlight,
        event.day = req.body.day,
        event.time = req.body.time,
        event.oldTime = req.body.oldTime,
        event.link = req.body.link,
        event.linkText = req.body.linkText,
        event.madeBy = req.body.name
        
        await event.save();
            console.log("UPDATED: " + event)

        
        res.redirect('/');
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).send('Internal Server Error');
    }
});

//Ein Event löschen
app.delete('/teamer/events', checkAuthenticated, async (req, res, next) => {
    try {
        const EventID = req.body.EventID;
    
        await Event.deleteOne({ _id: EventID });
        console.log("Deleted Event")
        res.redirect('/')

    } catch (error) {
        console.error('Fehler beim Löschen der Einträge:', error);
        res.redirect('/');
    }
    
});


//ALLE Events löschen
app.delete('/teamer/admin/delete-events', checkAdmin, async (req, res, next) => {
    try {
        // Löscht alle Einträge in der Kollektion
        const loeschErgebnis = await Event.deleteMany({});

        console.log(`Es wurden ${loeschErgebnis.deletedCount} Einträge gelöscht.`);
    } catch (error) {
        console.error('Fehler beim Löschen der Einträge:', error);
    }
    res.redirect('/teamer');
});
//Ende Events --------------------

//LogOut
app.delete('/teamer/logout', checkAuthenticated, (req, res, next) => {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/teamer/login');
    });
});

app.get('/500', (req, res) => {
    res.send("Error 500")
})

//404 Page
app.get('*', (req, res) => {
    res.render('404.ejs')
})

//Funktionen --------------------

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

async function getEventsbyDay(req) {
    let events;
    if (req.isAuthenticated()) {
        events = await Event.find()
    } else {
        events = await Event.find({}, { _id: 0 });
    }

    

    const sortedEvents = {
      Freitag: [],
      Samstag: [],
      Sonntag: []
    };
  
    events.forEach(event => {
      const { day } = event;
      if (sortedEvents.hasOwnProperty(day)) {
        sortedEvents[day].push(event);
      } else {
        console.error(`Ungültiger Tag: ${day}`);
      }
    });
  
    return sortedEvents;
  }
  

//Testing:


console.log("Server wird gestartet!")
app.listen(80)
