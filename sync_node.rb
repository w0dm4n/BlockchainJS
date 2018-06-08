i = 3001
while i < 3004 do
    system(`curl --header "Content-Type: application/json" --request POST --data '{"newNodeUrl": "http://localhost:#{i}"}' http://localhost:3000/register-and-broadcast-node`); 
    i += 1
end