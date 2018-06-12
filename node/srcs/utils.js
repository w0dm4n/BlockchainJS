export default class Utils {
    static convertNumArrayToHexString(list)
    {
        var result = "";
        for (var i = 0; i < list.length; i++) {
            let append = list[i].toString(16);
            if (append.length == 1) {
                append = `0${append}`;
            }
            result = `${result}${append}`;
        }
        return(result);
    }

    static convertHexStringToNumArray(str) {
        var result = [];
        for (var i = 0; i < str.length; i += 2) {
            let hexValue = `${str[i]}${str[i+1]}`;
            result.push(parseInt(hexValue, 16));
        }
        return (result);
    }
        
};