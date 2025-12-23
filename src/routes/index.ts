import {lazy} from "react";

const routerMap = [
    { path:"/", component: lazy(() => import("@/views/mainView/mainView.tsx")), name: "MainView" },
]

export default routerMap