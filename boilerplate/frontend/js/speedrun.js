

function clearOutput() {
  var parent = document.getElementById("outputDiv");
  parent.innerHTML = "";
}

function appendNewLine(node){
  //In wiki markup, you need this extra whitespace to force a new line
  var wikiNewLine = document.createTextNode("\u00A0\u00A0");
  node.appendChild(wikiNewLine);

  //Still need the line break to force the full new lines
  var linebreak = document.createElement('br');
  node.appendChild(linebreak);
}

function parseTime(time) {
  var split = time.toString().split(".");

  var totalSeconds = split[0];
  var seconds = totalSeconds % 60;
  var minutes = Math.floor(totalSeconds/60) % 60;
  var hours = Math.floor(totalSeconds/3600) % 24;
  var days = Math.floor(totalSeconds / 86400);

  var result = "";

  if(days != 0) {
    result += days + " days, ";
  }

  if(hours != 0) {
    if(minutes < 10) minutes = "0" + minutes;
    if(seconds < 10) seconds = "0" + seconds;

    result += hours + ":" + minutes + ":" + seconds;;
  }
  else if(minutes != 0) {
    if(seconds < 10) seconds = "0" + seconds;

    result += minutes + ":" + seconds;
  }
  else {
    result += seconds;
  }

  if(split.length == 2) {
    result = result + "." + split[1];
  }

  return result;
}

function getPlaceAsHumanReadable(number) {
  if(number == 1) return "WR";

  var lastDigit = number % 10;
  var secondToLastDigit = Math.round((number % 100)/10);

  //For the teens, always end with 'th'
  if(secondToLastDigit != 1) {
    if(lastDigit == 1) {
      return number + "st";
    }
    if(lastDigit == 2) {
      return number + "nd";
    }
    if(lastDigit == 3) {
      return number + "rd";
    }
  }

  return number + "th";
}

function getLink(text, url) {
  return "<a href=" + url + ">" + text + "</a>";
}

//This is used to track async calls so that, once they're all done, we can sort and display
var pendingRequests = 0;
var allRuns = [];

function allRunsFetched() {
  //Sort all alphabetically
  allRuns.sort(function(a, b){
    //Should probably use an internal name for this instead of removing the '**'
    return a.textContent.replace("**","").localeCompare(b.textContent.replace("**", ""));
  });

  var parent = document.getElementById("outputDiv");

  //Clear the 'fetching data' status then write the output
  clearOutput();

  for (var i = 0; i < allRuns.length; i++){
    parent.appendChild(allRuns[i]);
    appendNewLine(parent);
  }

  //Might have a better place to do this, but need to clear out allRuns in case we want to refetch
  allRuns = [];
}

function toWikiMarkup(speedrun, elementToWriteTo) {
  var AJAX = [];
  pendingRequests++;

  AJAX.push($.ajax({
     url: "https://www.speedrun.com/api/v1/games/" + speedrun.run.game + "?",
     datatype: 'json',
     type: "GET"
  }));

  AJAX.push($.ajax({
     url: "https://www.speedrun.com/api/v1/categories/" + speedrun.run.category + "?",
     datatype: 'json',
     type: "GET"
  }));

  $.when.apply($, AJAX).done(function(){
    //Pull these based on the order we called them in.
    //The second index refers to the following structure: [data, statusText, jqXHR]
    var gameInfo = arguments[0][0];
    var categoryInfo = arguments[1][0];

    var gameName = gameInfo.data.names.international;
    var category = categoryInfo.data.name;
    var place = getPlaceAsHumanReadable(speedrun.place);
    var time = parseTime(speedrun.run.times.primary_t);;
    var runLink = speedrun.run.weblink;
    var categoryLink = categoryInfo.data.weblink;

    //Bold lines that are for the world record
    if(speedrun.place == 1) {
      elementToWriteTo.style.fontWeight = 'bold';
    }

    elementToWriteTo.innerHTML = getLink(gameName, categoryLink) + " - " + category + ": " + getLink(time, runLink) + " (" + place + ")" ;

    pendingRequests--;

    if(pendingRequests == 0) {
      allRunsFetched();
    }
  }).fail(function (jqXHR, textStatus, errorThrown) {
    //TODO handle this better, but for now, just move on
    pendingRequests--;

    if(pendingRequests ==0) {
      allRunsFetched();
    }
  })
}

function loadSpeedRunStats(username){
    var maxPlace = 2147483647; //If empty default to largest int

    var parent = document.getElementById("outputDiv");
    //Clear the previous results
    parent.innerHTML = "Fetching data";

    pendingRequests++;

    $.ajax({
       url: "https://www.speedrun.com/api/v1/users/" + username + "/personal-bests?",
       datatype: 'json',
       type: "GET",
       success: function(result){
           parent.innerHTML = "Fetching speedrun details";

           //This is just the top level which is just "data"
           $.each(result, function(key, datalist){
             //This is to iterate the data list
             $.each(datalist, function(i, listItem){
               var element = document.createElement("game" + i);
               allRuns[i] = element;

               toWikiMarkup(listItem, element);
             });
           });
        pendingRequests--;

        if(pendingRequests == 0) {
          allRunsFetched();
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        parent.innerHTML = "Could not retrieve info for user: " + username;
      }
    });

}

window.Twitch.ext.onAuthorized(function(auth) {
  var url = "https://api.twitch.tv/helix/users?id=" + auth.channelId

  $.ajax({
     url: "https://api.twitch.tv/helix/users?id=" + auth.channelId,
     datatype: 'json',
     type: "GET",
     headers: { 'Client-ID': auth.clientId },
     success: function(result) {
       loadSpeedRunStats(result.data[0].login);
     }
  });

});
