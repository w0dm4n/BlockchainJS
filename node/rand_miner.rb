while 1 do
    bastard = rand(3000..3003)
    fundsaresafe = rand(1..10000)
    amount = rand(0.1..2.5)

    Thread.new {
        system('echo `sh "/Users/frmarinh/Desktop/BlockchainJS/transactionBuilder/lol.sh"`');
    }

    Thread.new {
        system(`curl localhost:#{bastard}/mine`)
    }

    puts "#{bastard.to_s} is now mining a new block"
    sleep 15
end