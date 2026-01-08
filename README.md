# The Newsvendor Game

This is an open-source implementation of the newsvendor game. The newsvendor game is an excellent introduction to inventory management, and illustrates the asymmetric risk between ordering too high or too low. Note that since noone sells newspapers anymore, I changed the context to a croissant bakery.

## Version Update

This is V1.

## Hosting

I host this version of the game at https://go.wisc.edu/z301dk. You can set up a session with the password Sesame, and log in as a player using a separate browser window. I would appreciate some playtesting, if you have the time, and feel free to use it in the classroom!. I added a guide on how to set up hosting yourself for free [here](https://github.com/siemsene/beergame/blob/main/Howtohost.md).

The hosted game runs on cloud services (Firebase). These services are free only up to certain daily usage limits. Above those limits, I incur out-of-pocket costs.

- The hosted game is **free to use** for typical classroom and workshop sizes.
- As a rough guideline, up to about **200 players per day in total across all hosts** fits comfortably within the free tier.
- Above that level, I may incur additional costs for database reads/writes, bandwidth, and related hosting resources.

I reserve the right to:

- Limit or throttle access (for example, limiting new games if daily usage is very high), and/or
- Ask heavy users to share in the actual hosting costs their sessions generate.

## Other Newsvendor Games

There is a paid version at [FathomD](https://www.fathomd.com/nvg).

## License

This version of the beer game is open source and has a [Creative Commons license](https://creativecommons.org/licenses/by-sa/4.0/). You can use it for free, and you can modify the code as you see fit; but anything you build on this code has to fall under the same license.

## How to Start a Session

To host a game, you first need to log in as a host; it will ask you for a password, which is 'Sesame'. I know - not very secure, but enough for now. You can then create a new session with a Game ID. You can share this ID with students, who can then log in with this game ID and a Name. This can be any name, but they should remember it, since if they get disconnected from the game, they can always reconnect using the Game ID and their name as long as the session is still running.

You can test this out yourself with multiple browser tabs.

You can monitor the lobby as the host and remove players if you want to. You can also redraw the dataset used for the session - I tried to draw datasets that are representative of the distribution, and offer a clear advantage when people actually order the critical fractile. When all players have registered, you can start the game.

## Game Rules

You can define game parameters as the host. I implemented a structure in which players make decisions for one week (one order quantity delivered on each of 5 days), after which demand for that week is revealed (all 5 days). 
