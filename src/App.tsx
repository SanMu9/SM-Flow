import routerMap from "@/routes";
import './App.css'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import {Suspense} from "react";
import {DndProvider} from "react-dnd";
import {HTML5Backend} from "react-dnd-html5-backend";
function App() {
    const routes = routerMap.map(item => {
        return (
                <Route key={item.name} path={item.path} Component={item.component} />
        )
    })

  return (
    <>
        <DndProvider backend={HTML5Backend}>
            <Router>
                <Suspense>
                    <Routes>
                        {routes}
                    </Routes>
                </Suspense>
            </Router>
        </DndProvider>
    </>
  )
}

export default App
