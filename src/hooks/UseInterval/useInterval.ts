import { useEffect, useRef } from "react";

export const useInterval = (callback:()=>void, delay:number) =>{
    const savedCallback = useRef(callback);

    useEffect(()=>{
        savedCallback.current = callback;
    },[callback])

    useEffect(()=>{
        const getCordinates = () =>{
            savedCallback.current();
        }
        if(delay!==null){
            let id = setInterval(getCordinates, delay);
            return ()=> clearInterval(id);
        }
    }, [delay])
}