import axios from "axios"
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";

// API to get now playing movies from TMDB API
export const getNowPlayingMovies = async (req, res)=>{
    try {
        const { data } = await axios.get('https://api.themoviedb.org/3/movie/now_playing', {
            headers: {Authorization : `Bearer ${process.env.TMDB_API_KEY}`}
        })

        const movies = data.results;
        res.json({success: true, movies: movies})
    } catch (error) {
        console.error(error);
        res.json({success: false, message: error.message})
    }
}

// API to add a new show to the database
export const addShow = async (req, res) =>{
    try {
        const {movieId, showsInput, showPrice} = req.body

        let movie = await Movie.findById(movieId)

        if(!movie) {
            // Fetch movie details and credits from TMDB API
            const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
            headers: {Authorization : `Bearer ${process.env.TMDB_API_KEY}`} }),

                axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
            headers: {Authorization : `Bearer ${process.env.TMDB_API_KEY}`} })
            ]);

            const movieApiData = movieDetailsResponse.data;
            const movieCreditsData = movieCreditsResponse.data;

             const movieDetails = {
                _id: movieId,
                title: movieApiData.title,
                overview: movieApiData.overview,
                poster_path: movieApiData.poster_path,
                backdrop_path: movieApiData.backdrop_path,
                genres: movieApiData.genres,
                casts: movieCreditsData.cast,
                release_date: movieApiData.release_date,
                original_language: movieApiData.original_language,
                tagline: movieApiData.tagline || "",
                vote_average: movieApiData.vote_average,
                runtime: movieApiData.runtime,
             }

             // Add movie to the database
             movie = await Movie.create(movieDetails);
        }

        const showsToCreate = [];
        showsInput.forEach(show => {
            const showDate = show.date;
            show.time.forEach((time)=>{
                const dateTimeString = `${showDate}T${time}`;
                showsToCreate.push({
                    movie: movieId,
                    showDateTime: new Date(dateTimeString),
                    showPrice,
                    occupiedSeats: {}
                })
            })
        });

        if(showsToCreate.length > 0){
            await Show.insertMany(showsToCreate);
        }

         //  Trigger Inngest event
         await inngest.send({
            name: "app/show.added",
             data: {movieTitle: movie.title}
         })

        res.json({success: true, message: 'Show Added successfully.'})
    } catch (error) {
        console.error(error);
        res.json({success: false, message: error.message})
    }
}

// API to get all shows from the database
export const getShows = async (req, res) =>{
    try {
        const shows = await Show.find({showDateTime: {$gte: new Date()}}).populate('movie').sort({ showDateTime: 1 });

        // filter unique shows
        const uniqueShows = new Set(shows.map(show => show.movie))

        res.json({success: true, shows: Array.from(uniqueShows)})
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// API to get a single show from the database
export const getShow = async (req, res) =>{
    try {
        const {movieId} = req.params;
        // get all upcoming shows for the movie
        const shows = await Show.find({movie: movieId, showDateTime: { $gte: new Date() }})

        const movie = await Movie.findById(movieId);
        const dateTime = {};

        shows.forEach((show) => {
            const date = show.showDateTime.toISOString().split("T")[0];
            if(!dateTime[date]){
                dateTime[date] = []
            }
            dateTime[date].push({ time: show.showDateTime, showId: show._id })
        })

        res.json({success: true, movie, dateTime})
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// import axios from "axios"
// import Movie from "../models/Movie.js";
// import Show from "../models/Show.js";
// import { inngest } from "../inngest/index.js";

// // API to get now playing movies from OMDB API
// export const getNowPlayingMovies = async (req, res) => {
//     try {
//         // You can customize search or use a static list of IMDb IDs
//         const movieTitles = ["Inception", "The Dark Knight", "Interstellar", "Tenet"];
//         const movies = [];

//         for (let title of movieTitles) {
//             const { data } = await axios.get(`http://www.omdbapi.com/`, {
//                 params: {
//                     t: title,
//                     apikey: process.env.OMDB_API_KEY
//                 }
//             });

//             if (data && data.Response !== "False") {
//                 movies.push(data);
//             }
//         }

//         res.json({ success: true, movies });
//     } catch (error) {
//         console.error(error);
//         res.json({ success: false, message: error.message });
//     }
// };

// // API to add a new show to the database
// export const addShow = async (req, res) => {
//     try {
//         const { movieId, showsInput, showPrice } = req.body;

//         let movie = await Movie.findById(movieId);

//         if (!movie) {
//             // Fetch movie details from OMDB API
//             const { data: movieApiData } = await axios.get(`http://www.omdbapi.com/`, {
//                 params: {
//                     i: movieId, // IMDb ID
//                     apikey: process.env.OMDB_API_KEY
//                 }
//             });

//             if (!movieApiData || movieApiData.Response === "False") {
//                 throw new Error("Movie not found in OMDB API");
//             }

//             const movieDetails = {
//                 _id: movieId,
//                 title: movieApiData.Title,
//                 overview: movieApiData.Plot,
//                 poster_path: movieApiData.Poster,
//                 backdrop_path: movieApiData.Poster, // OMDB does not have separate backdrop
//                 genres: movieApiData.Genre?.split(", "),
//                 casts: movieApiData.Actors?.split(", "),
//                 release_date: movieApiData.Released,
//                 original_language: movieApiData.Language,
//                 tagline: "",
//                 vote_average: parseFloat(movieApiData.imdbRating),
//                 runtime: parseInt(movieApiData.Runtime) || 120,
//             };

//             movie = await Movie.create(movieDetails);
//         }

//         const showsToCreate = [];
//         showsInput.forEach(show => {
//             const showDate = show.date;
//             show.time.forEach((time) => {
//                 const dateTimeString = `${showDate}T${time}`;
//                 showsToCreate.push({
//                     movie: movieId,
//                     showDateTime: new Date(dateTimeString),
//                     showPrice,
//                     occupiedSeats: {}
//                 });
//             });
//         });

//         if (showsToCreate.length > 0) {
//             await Show.insertMany(showsToCreate);
//         }

//         await inngest.send({
//             name: "app/show.added",
//             data: { movieTitle: movie.title }
//         });

//         res.json({ success: true, message: 'Show Added successfully.' });
//     } catch (error) {
//         console.error(error);
//         res.json({ success: false, message: error.message });
//     }
// };

// // API to get all shows from the database
// export const getShows = async (req, res) => {
//     try {
//         const shows = await Show.find({ showDateTime: { $gte: new Date() } }).populate('movie').sort({ showDateTime: 1 });
//         const uniqueShows = new Set(shows.map(show => show.movie));
//         res.json({ success: true, shows: Array.from(uniqueShows) });
//     } catch (error) {
//         console.error(error);
//         res.json({ success: false, message: error.message });
//     }
// };

// // API to get a single show from the database
// export const getShow = async (req, res) => {
//     try {
//         const { movieId } = req.params;
//         const shows = await Show.find({ movie: movieId, showDateTime: { $gte: new Date() } });
//         const movie = await Movie.findById(movieId);

//         const dateTime = {};
//         shows.forEach((show) => {
//             const date = show.showDateTime.toISOString().split("T")[0];
//             if (!dateTime[date]) {
//                 dateTime[date] = [];
//             }
//             dateTime[date].push({ time: show.showDateTime, showId: show._id });
//         });

//         res.json({ success: true, movie, dateTime });
//     } catch (error) {
//         console.error(error);
//         res.json({ success: false, message: error.message });
//     }
// };