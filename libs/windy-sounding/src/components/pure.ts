import { Component } from 'preact';

// Shallow diff
function diff(a: any, b: any) {
  for (const i in a) {
    if (!(i in b)) {
      return true;
    }
  }
  for (const i in b) {
    if (a[i] !== b[i]) {
      return true;
    }
  }
  return false;
}

// @ts-expect-error TS(2515): Non-abstract class 'PureComponent' does not implem... Remove this comment to see the full error message
export class PureComponent extends Component {
  override shouldComponentUpdate(props: any, state: any) {
    return diff(this.props, props) || diff(this.state, state);
  }
}
