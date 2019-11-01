import { LitElement, PropertyValues, customElement, property } from 'lit-element';

@customElement('task-element')
export class TaskElement extends LitElement {
  @property()
  query: string | null = null;

  @property()
  map: google.maps.Map | null = null;

  rendered = false;

  protected addTask(): void {
    if (this.map && this.query) {
      const params = new URLSearchParams(this.query);
      const routeType = params.get('flightType');
      const turnpoints = params.get('turnpoints');
      const start = params.get('start');
      const end = params.get('end');
      if (routeType && turnpoints) {
        const tps = JSON.parse(turnpoints).map(tupleToLatLng);
        const s = start ? tupleToLatLng(JSON.parse(start)) : null;
        const e = end ? tupleToLatLng(JSON.parse(end)) : null;
        const isClosed = routeType[0] == 'c';
        const lineSymbol = {
          path: 'M 0,-1 0,1',
          strokeOpacity: 0.8,
          scale: 2,
        };

        if (s && isClosed) {
          new google.maps.Polyline({
            clickable: false,
            map: this.map,
            path: [s, tps[0]],
            strokeColor: '#44f',
            strokeOpacity: 0,
            icons: [
              {
                icon: lineSymbol,
                offset: '0px',
                repeat: '10px',
              },
            ],
          });
        }

        if (e && isClosed) {
          new google.maps.Polyline({
            clickable: false,
            map: this.map,
            path: [e, tps[tps.length - 1]],
            strokeColor: '#44f',
            strokeOpacity: 0,
            icons: [
              {
                icon: lineSymbol,
                offset: '0px',
                repeat: '10px',
              },
            ],
          });
        }

        new google.maps.Marker({
          clickable: false,
          position: isClosed && s ? s : tps[0],
          map: this.map,
          icon: {
            url: 'https://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_green.png',
            size: new google.maps.Size(12, 20),
          },
        });
        new google.maps.Marker({
          clickable: false,
          position: isClosed && e ? e : tps[tps.length - 1],
          map: this.map,
          icon: {
            url: 'https://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_red.png',
            size: new google.maps.Size(12, 20),
          },
        });

        new google.maps.Polyline({
          clickable: false,
          map: this.map,
          path: isClosed ? tps.concat(tps[0]) : tps,
          strokeColor: '#00f',
          strokeOpacity: 0.8,
          strokeWeight: 2,
        });

        tps.forEach((tp: google.maps.LatLng) => {
          new google.maps.Marker({
            clickable: false,
            position: tp,
            map: this.map as google.maps.Map,
            icon: {
              url: 'https://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_orange.png',
              size: new google.maps.Size(12, 20),
            },
          });
        });
      }
    }
  }

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (!this.rendered) {
      if (this.map && this.query) {
        this.addTask();
        this.rendered = true;
      }
    }
    return false;
  }
}

function tupleToLatLng(coords: [number, number]): google.maps.LatLng {
  return new google.maps.LatLng(coords[0], coords[1]);
}
