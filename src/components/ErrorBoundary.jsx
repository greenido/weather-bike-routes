/*
  File: src/components/ErrorBoundary.jsx
  Purpose: Keep one broken panel from blanking the whole page.
  What it does:
  - Catches a render error below it and shows a short message with a "Try again" button, instead of React
    unmounting the entire app and leaving a white page.
  - `resetKey` clears the error when it changes, so selecting a different route gives the panel a fresh start.
  Notes:
  - Error boundaries have no hook form; this has to be a class.
*/
import { Component } from 'react'
import { logEvent } from '../services/logger'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    logEvent({ type: 'ui:error', where: this.props.label, message: error?.message, stack: info?.componentStack })
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mt-8 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4" role="alert">
        <p className="font-medium text-red-800 dark:text-red-200">This part of the page stopped working.</p>
        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
          The rest of the app is fine — your routes and scores are still above. {this.state.error?.message}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-3 px-3 py-1.5 text-sm rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-950"
        >
          Try again
        </button>
      </div>
    )
  }
}
