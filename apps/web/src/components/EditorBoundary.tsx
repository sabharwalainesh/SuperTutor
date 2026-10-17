import { Component, type ReactNode } from 'react';

/** A deployment can replace a lazily loaded editor chunk while a student keeps a tab open. */
export class EditorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <section className="pane"><div className="content" role="alert"><h2>The editor needs a refresh</h2><p className="muted">Reload the workspace to load the latest editor. Saved work stays in your account.</p><button className="primary" onClick={()=>window.location.reload()}>Reload workspace</button></div></section>;
    return this.props.children;
  }
}
