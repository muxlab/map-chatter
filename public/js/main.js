// Remove the ugly Facebook appended hash
// <https://github.com/jaredhanson/passport-facebook/issues/12>
(function removeFacebookAppendedHash() {
  if (!window.location.hash || window.location.hash !== '#_=_')
    return;
  if (window.history && window.history.replaceState)
    return window.history.replaceState("", document.title, window.location.pathname);
  // Prevent scrolling by storing the page's current scroll offset
  var scroll = {
    top: document.body.scrollTop,
    left: document.body.scrollLeft
  };
  window.location.hash = "";
  // Restore the scroll offset, should be flicker free
  document.body.scrollTop = scroll.top;
  document.body.scrollLeft = scroll.left;
}());

$(function() {
  console.log('%c⚛ Map Chatter: Hello geohacker! ⚛', 'font-family:monospace;font-size:16px;color:darkblue;');

  // Grobal
  var map, japan, world, markers = [];
  var firstPost = true;
  var socket = io();
  var myroomid = 0;
  var me = {
    name: $('#name').text(), // ""
    id: $('img.avator-icon').attr('id'), // null
    text: "",
  };
  var mylocation = {
    name: $('#name').text(), // ""
    id: $('img.avator-icon').attr('id'),
    lat: 35.67744,
    lng: 139.739
  };
  // Extend Leaflet Icon
  var AvatarIcon = L.Icon.extend({
    options: {
      className: 'leaflet-avator-icon', // Custom Icon Class
      iconSize: [40, 40], // Avatar Image Size
      iconAnchor: [20, 20], // Centralizing icon
      popupAnchor: [3, -20] // Centralizing popup
    }
  });

  function initMap() {
    L.Map = L.Map.extend({
      openPopup: function(popup) {
        // this.closePopup();  // just comment this
        this._popup = popup;
        return this.addLayer(popup).fire('popupopen', {
          popup: this._popup
        });
      }
    });
    map = L.map('map', { zoomControl: false, maxZoom: 10, closePopupOnClick: false }).setView([36, 139], 5);
    var defaultStyle = {
      className: 'world-line',
      color: '#ff6500',
      weight: 1,
      opacity: 0.6,
      fillOpacity: 0
    }
    var highlightStyle = {
      color: '#ff6500',
      weight: 4,
      opacity: 0.6,
      fillOpacity: 0.65,
      fillColor: '#ff6500'
    };
    $.getJSON('../data/world.geojson', function(data) {
      world = L.geoJson(data, {
        onEachFeature: function (feature, layer) {
          layer.setStyle(defaultStyle);
          (function(layer, properties) {
            layer.on('mouseover', function (e) {
              layer.setStyle(highlightStyle);
            });
            layer.on('mouseout', function (e) {
              layer.setStyle(defaultStyle);
            });
          })(layer, feature.properties);
        }
      });
      map.fitBounds(world.getBounds());
      world.addTo(map);
      var worldPath = d3.selectAll('.leaflet-zoom-animated').selectAll('g').selectAll('path.world-line');
      setTimeout(function() {
        worldPath.style({ 'stroke-dasharray': 0 });
        startChat(myroomid);
      }, 10000);
      worldPath.transition().delay(300).duration(14000).style({ 'stroke-dashoffset': 0 });
    });
  }

  function startChat(roomid) {
    socket.emit('join', {
      roomid: roomid,
      name: me.name,
      id: me.id
    });
    setMe();
    socketEventListner();
  }

  function socketEventListner() {
    // Got message
    socket.on('chat message', function(msg) {
      var nosameid = true;
      var usr = msg.name;
      var fbid = msg.id;
      var txt = msg.text;

      for(var i=0; i<markers.length; i++) {
        console.log(markers[i]);
        console.log(usr);
        if(markers[i].id == fbid) {
          nosameid = false;
          console.log(usr, txt);
          console.log(markers[i].marker);
          markers[i].currentMsg = txt;
          markers[i].marker.closePopup();
          markers[i].marker.bindPopup('<p>' + txt + '</p>', { closeButton: false }).openPopup();
        }
      }
      // New people!
      if(nosameid === true) {
        console.log("NEW PEOPLE!!");
        var yourText = '<p>Hello! I am ' + msg.name + '.</p>';
        var yourIcon = new AvatarIcon({iconUrl: 'https://graph.facebook.com/' + msg.id + '/picture'});
        var marker = L.marker([msg.lat, msg.lng], { alt: 'people', title: msg.name, icon: yourIcon }).addTo(map);
        marker.bindPopup(yourText, { closeButton: false }).openPopup();
        map.panTo([msg.lat, msg.lng]);
        markers.push({
          marker: marker,
          id: msg.id,
          name: msg.name,
          currentMsg: ''
        });
      }
    });
    // Got location
    socket.on('location message', function(msg) {
      var nosameid = true;

      for(var i=0; i<markers.length; i++) {
        console.log(markers[i]);
        if(markers[i].id === msg.id) {
          nosameid = false;
          markers[i].marker.setLatLng([msg.lat, msg.lng]);
          // 自分の緯度経度の更新
          if(msg.id === me.id) {
            mylocation.lat = msg.lat;
            mylocation.lng = msg.lng;
          }
        }
      }

      // New people!
      if(nosameid === true) {
        console.log("NEW PEOPLE!!");
        var yourText = '<p>Hello! I am ' + msg.name + '.</p>';
        var yourIcon = new AvatarIcon({iconUrl: 'https://graph.facebook.com/' + msg.id + '/picture'});
        var marker = L.marker([msg.lat, msg.lng], { alt: 'people', title: msg.name, icon: yourIcon }).addTo(map);
        marker.bindPopup(yourText, { closeButton: false }).openPopup();
        map.panTo([msg.lat, msg.lng]);
        markers.push({
          marker: marker,
          id: msg.id,
          name: msg.name,
          currentMsg: ''
        });
      }
    });
  }

  function setMe() {
    var options = { maximumAge: 600000, timeout: 10000, enableHighAccuracy: false };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(locationChange, locationError);
      navigator.geolocation.watchPosition(locationChange, locationError);
    }
    else {
      socket.emit('location message', mylocation);
    }
  }

  function locationChange(e) {
    mylocation.lat = e.coords.latitude;
    mylocation.lng = e.coords.longitude;
    socket.emit('location message', mylocation);
  }

  function locationError(e) {
    console.log(e);
    socket.emit('location message', mylocation);
  }

  initMap();

  $('button.btn-chatter').on('click', function (e) {
    console.log($('input.chatter').val());
    me.text = $('input.chatter').val();
    socket.emit('chat message', me);
    $('input.chatter').val('');
    markers[0].currentMsg = me.text;
    markers[0].marker.setPopupContent('<p>' + me.text + '</p>');
    return false;
  });

});
